import { Router } from "express";
import adminRoutes from "./admin/admin.routes";
import authRoutes from "./auth/auth.routes";
import artistRoutes from "./artist/artist.routes";
import availabilityRoutes from "./availability/availability.routes";
import bookingRoutes from "./booking/booking.routes";
import catalogRoutes from "./catalog/catalog.routes";
import customerRoutes from "./customer/customer.routes";
import kycRoutes from "./kyc/kyc.routes";
import mediaRoutes from "./media/media.routes";
import paymentRoutes from "./payment/payment.routes";

const router = Router();

router.use("/", authRoutes);
router.use("/", customerRoutes);
router.use("/", artistRoutes);
router.use("/", availabilityRoutes);
router.use("/", bookingRoutes);
router.use("/", paymentRoutes);
router.use("/", catalogRoutes);
router.use("/", kycRoutes);
router.use("/", adminRoutes);
router.use("/", mediaRoutes);

export default router;
