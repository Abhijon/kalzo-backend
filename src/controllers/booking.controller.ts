import type { Request, Response } from "express";
import * as artistService from "../services/artist.service";
import * as availabilityService from "../services/availability.service";
import * as bookingService from "../services/booking.service";
import * as mediaService from "../services/media.service";
import { ApiError } from "../utils/apiError";
import { isBookingOtp, matchesBookingOtp, normalizeOtp } from "../utils/bookingCodes";
import {
  BOOKING_STATUS,
  BOOKING_STATUSES,
  OTP_MAX_ATTEMPTS,
  canTransition,
  type BookingStatusValue,
} from "../utils/bookingStatus";
import { toBookingDto } from "../utils/bookingResponse";
import { paginationMeta, parsePagination } from "../utils/pagination";
import { PAYMENT_STATUS } from "../utils/paymentStatus";
import { sendSuccess } from "../utils/response";
import { VERIFICATION_STATUS } from "../utils/verification";
import { weekdayName } from "../utils/weekdays";

async function loadArtistPaidBooking(req: Request) {
  const profile = await artistService.ensureProfileByUserId(req.user!.id);
  const booking = await bookingService.findBookingById(String(req.params.id));
  if (
    !booking ||
    booking.artistProfileId !== profile.id ||
    booking.paymentStatus !== PAYMENT_STATUS.PAID
  ) {
    throw new ApiError(404, "Booking not found");
  }
  return { profile, booking };
}

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
      message: "Booking created. Complete payment to send the invitation to the artist.",
      booking: toBookingDto(booking, "customer"),
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
    bookings: bookings.map((b) => toBookingDto(b, "customer")),
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
  // Artists only see the booking after payment succeeds.
  if (isArtist && !isCustomer && booking.paymentStatus !== PAYMENT_STATUS.PAID) {
    throw new ApiError(404, "Booking not found");
  }

  sendSuccess(res, {
    booking: toBookingDto(booking, isCustomer ? "customer" : "artist"),
  });
}

/** GET /bookings/:id/codes — patron-only OTP reveal for the current stage. */
export async function getBookingCodes(req: Request, res: Response) {
  const booking = await bookingService.findBookingById(String(req.params.id));
  if (!booking || booking.customerUserId !== req.user!.id) {
    throw new ApiError(404, "Booking not found");
  }
  if (booking.paymentStatus !== PAYMENT_STATUS.PAID) {
    throw new ApiError(400, "Codes are available after payment");
  }

  const withCodes = (await bookingService.ensureBookingCodes(booking.id)) ?? booking;
  const dto = toBookingDto(withCodes, "customer");
  sendSuccess(res, {
    codeReveal: dto.codeReveal,
    arrivalCode: dto.arrivalCode,
    closingCode: dto.closingCode,
    status: booking.status,
  });
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
    bookings: bookings.map((b) => toBookingDto(b, "artist")),
    pagination: paginationMeta(totalCount, q),
  });
}

export async function updateBookingStatus(req: Request, res: Response) {
  const { booking } = await loadArtistPaidBooking(req);

  const status = String(req.body.status ?? "").trim() as BookingStatusValue;
  const allowed: BookingStatusValue[] = [
    BOOKING_STATUS.ACCEPTED,
    BOOKING_STATUS.REJECTED,
    BOOKING_STATUS.ARRIVED,
    BOOKING_STATUS.FINISHED,
  ];
  if (!allowed.includes(status)) {
    throw new ApiError(400, `status must be one of: ${allowed.join(", ")}`);
  }

  const from = booking.status as BookingStatusValue;
  if (!canTransition(from, status)) {
    throw new ApiError(400, `Cannot change booking from "${from}" to "${status}"`);
  }

  if (status === BOOKING_STATUS.ARRIVED) {
    await bookingService.ensureBookingCodes(booking.id);
  }

  const updated = await bookingService.updateBookingStatus(booking.id, status);
  sendSuccess(res, {
    message: `Booking ${status.replace(/_/g, " ")}.`,
    booking: toBookingDto(updated, "artist"),
  });
}

/** POST /artist/bookings/:id/arrival/verify — patron arrival OTP. */
export async function verifyArrivalCode(req: Request, res: Response) {
  const { booking } = await loadArtistPaidBooking(req);
  if (booking.status !== BOOKING_STATUS.ARRIVED) {
    throw new ApiError(400, "Arrival OTP is only accepted after you mark venue arrival");
  }
  if ((booking.arrivalAttempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    throw new ApiError(429, "Too many incorrect arrival codes. Contact Kalzo support.");
  }

  const code = normalizeOtp(req.body.code);
  if (!isBookingOtp(code)) {
    throw new ApiError(400, "Enter the six-digit arrival OTP from the patron");
  }

  if (!matchesBookingOtp(code, booking.arrivalCode)) {
    const attempts = (booking.arrivalAttempts ?? 0) + 1;
    await bookingService.updateBookingFields(booking.id, { arrivalAttempts: attempts });
    const left = OTP_MAX_ATTEMPTS - attempts;
    throw new ApiError(
      400,
      left > 0
        ? `Incorrect arrival OTP. ${left} attempt${left === 1 ? "" : "s"} left.`
        : "Too many incorrect arrival codes. Contact Kalzo support.",
    );
  }

  const updated = await bookingService.updateBookingFields(booking.id, {
    status: BOOKING_STATUS.ARRIVAL_CONFIRMED,
    arrivalAttempts: 0,
  });
  sendSuccess(res, {
    message: "Arrival confirmed. Record your venue check-in video next.",
    booking: toBookingDto(updated, "artist"),
  });
}

/** POST /artist/bookings/:id/venue-video — live venue proof after arrival OTP. */
export async function submitVenueVideo(req: Request, res: Response) {
  const { profile, booking } = await loadArtistPaidBooking(req);
  if (booking.status !== BOOKING_STATUS.ARRIVAL_CONFIRMED) {
    throw new ApiError(400, "Confirm arrival OTP before submitting the venue video");
  }

  const path = String(req.body.path ?? req.body.venueVideoPath ?? "").trim();
  if (!path) throw new ApiError(400, "venue video path is required");

  const [safe] = await mediaService.assertOwnedMediaKeysExist(profile.userId, [path]);

  const updated = await bookingService.updateBookingFields(booking.id, {
    venueVideoPath: safe,
    status: BOOKING_STATUS.PERFORMING,
  });
  sendSuccess(res, {
    message: "Venue video saved. Enjoy the performance — ask for the closing OTP when done.",
    booking: toBookingDto(updated, "artist"),
  });
}

/** POST /artist/bookings/:id/closing/verify — patron closing OTP. */
export async function verifyClosingCode(req: Request, res: Response) {
  const { booking } = await loadArtistPaidBooking(req);
  if (booking.status !== BOOKING_STATUS.FINISHED) {
    throw new ApiError(400, "Closing OTP is only accepted after you mark the show finished");
  }
  if ((booking.closingAttempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    throw new ApiError(429, "Too many incorrect closing codes. Contact Kalzo support.");
  }

  const code = normalizeOtp(req.body.code);
  if (!isBookingOtp(code)) {
    throw new ApiError(400, "Enter the six-digit closing OTP from the patron");
  }

  if (!matchesBookingOtp(code, booking.closingCode)) {
    const attempts = (booking.closingAttempts ?? 0) + 1;
    await bookingService.updateBookingFields(booking.id, { closingAttempts: attempts });
    const left = OTP_MAX_ATTEMPTS - attempts;
    throw new ApiError(
      400,
      left > 0
        ? `Incorrect closing OTP. ${left} attempt${left === 1 ? "" : "s"} left.`
        : "Too many incorrect closing codes. Contact Kalzo support.",
    );
  }

  const updated = await bookingService.updateBookingFields(booking.id, {
    status: BOOKING_STATUS.COMPLETED,
    closingAttempts: 0,
    payoutStatus: "setup_required",
  });
  sendSuccess(res, {
    message: "Show completed. Payment is queued for admin release — not yet paid to your bank.",
    booking: toBookingDto(updated, "artist"),
  });
}
