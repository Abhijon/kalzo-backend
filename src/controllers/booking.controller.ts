import type { Request, Response } from "express";
import * as artistService from "../services/artist.service";
import * as availabilityService from "../services/availability.service";
import * as bookingService from "../services/booking.service";
import { ApiError } from "../utils/apiError";
import {
  BOOKING_STATUS,
  BOOKING_STATUSES,
  canTransition,
  type BookingStatusValue,
} from "../utils/bookingStatus";
import { toBookingDto } from "../utils/bookingResponse";
import { paginationMeta, parsePagination } from "../utils/pagination";
import { sendSuccess } from "../utils/response";
import { VERIFICATION_STATUS } from "../utils/verification";
import { weekdayName } from "../utils/weekdays";

/** GET /booking-statuses — public list of BookingStatus enum values */
export async function listBookingStatuses(_req: Request, res: Response) {
  sendSuccess(res, { statuses: BOOKING_STATUSES });
}

/** POST /bookings — customer books a calendar date (weekday must be active). No payment. */
export async function createBooking(req: Request, res: Response) {
  const artistProfileId = String(req.body.artistId ?? req.body.artistProfileId ?? "").trim();
  const eventDateStr = String(req.body.eventDate ?? req.body.date ?? "").trim();
  const address = String(req.body.address ?? "").trim();
  const guests = req.body.guests != null ? String(req.body.guests).trim() : null;
  const note = req.body.note != null ? String(req.body.note).trim() : null;

  if (!artistProfileId) throw new ApiError(400, "artistId is required");
  const eventDate = availabilityService.parseDateOnly(eventDateStr);
  if (!eventDate) throw new ApiError(400, "eventDate must be YYYY-MM-DD");
  if (address.length < 5) throw new ApiError(400, "Please enter a venue address");

  const artist = await artistService.findProfileById(artistProfileId);
  if (!artist || artist.verificationStatus !== VERIFICATION_STATUS.VERIFIED) {
    throw new ApiError(404, "Artist not found");
  }

  const weekday = availabilityService.weekdayFromDate(eventDate);
  const open = await availabilityService.isWeekdayActive(artist.id, weekday);
  if (!open) {
    throw new ApiError(
      400,
      `${weekdayName(weekday)} is not available for this artist`,
    );
  }

  const blocking = await bookingService.countBlockingBookingsForDate(artist.id, eventDate);
  if (blocking > 0) {
    throw new ApiError(409, "This date is already booked with this artist");
  }

  const amountInr =
    typeof req.body.amountInr === "number" && req.body.amountInr >= 0
      ? Math.floor(req.body.amountInr)
      : (artist.rateInr ?? 0);

  const booking = await bookingService.createBooking({
    customerUserId: req.user!.id,
    artistProfileId: artist.id,
    eventDate,
    address,
    guests,
    note,
    amountInr,
  });

  sendSuccess(
    res,
    {
      message: "Booking request sent. Waiting for the artist to respond.",
      booking: toBookingDto(booking),
    },
    201,
  );
}

export async function listMyBookings(req: Request, res: Response) {
  const q = parsePagination(req.query);
  const { bookings, totalCount } = await bookingService.listCustomerBookings(
    req.user!.id,
    { limit: q.limit, offset: q.offset },
  );
  sendSuccess(res, {
    bookings: bookings.map(toBookingDto),
    pagination: paginationMeta(totalCount, q),
  });
}

export async function getBookingById(req: Request, res: Response) {
  const booking = await bookingService.findBookingById(String(req.params.id));
  if (!booking) throw new ApiError(404, "Booking not found");

  const userId = req.user!.id;
  const myArtist = await artistService.findProfileByUserId(userId);
  const isCustomer = booking.customerUserId === userId;
  const isArtist = myArtist?.id === booking.artistProfileId;
  if (!isCustomer && !isArtist) {
    throw new ApiError(403, "You do not have access to this booking");
  }

  sendSuccess(res, { booking: toBookingDto(booking) });
}

export async function listArtistBookings(req: Request, res: Response) {
  const profile = await artistService.ensureProfileByUserId(req.user!.id);
  const q = parsePagination(req.query);
  const raw = req.query.status != null ? String(req.query.status).trim() : "";
  let status: BookingStatusValue | undefined;
  if (raw) {
    if (!BOOKING_STATUSES.includes(raw as BookingStatusValue)) {
      throw new ApiError(
        400,
        `status must be one of: ${BOOKING_STATUSES.join(", ")}`,
      );
    }
    status = raw as BookingStatusValue;
  }

  const { bookings, totalCount } = await bookingService.listArtistBookings(
    profile.id,
    { limit: q.limit, offset: q.offset, status },
  );
  sendSuccess(res, {
    status: status ?? "all",
    bookings: bookings.map(toBookingDto),
    pagination: paginationMeta(totalCount, q),
  });
}

export async function updateBookingStatus(req: Request, res: Response) {
  const profile = await artistService.ensureProfileByUserId(req.user!.id);
  const booking = await bookingService.findBookingById(String(req.params.id));
  if (!booking || booking.artistProfileId !== profile.id) {
    throw new ApiError(404, "Booking not found");
  }

  const status = String(req.body.status ?? "").trim() as BookingStatusValue;
  const allowed: BookingStatusValue[] = [
    BOOKING_STATUS.ACCEPTED,
    BOOKING_STATUS.REJECTED,
    BOOKING_STATUS.JOB_STARTED,
    BOOKING_STATUS.COMPLETED,
  ];
  if (!allowed.includes(status)) {
    throw new ApiError(400, `status must be one of: ${allowed.join(", ")}`);
  }

  const from = booking.status as BookingStatusValue;
  if (!canTransition(from, status)) {
    throw new ApiError(400, `Cannot change booking from "${from}" to "${status}"`);
  }

  const updated = await bookingService.updateBookingStatus(booking.id, status);
  sendSuccess(res, {
    message: `Booking ${status.replace("_", " ")}.`,
    booking: toBookingDto(updated),
  });
}
