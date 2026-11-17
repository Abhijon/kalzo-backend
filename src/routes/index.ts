import { Router } from "express";
import adminRoutes from "./admin/admin.routes";
import authRoutes from "./auth/auth.routes";
import artistRoutes from "./artist/artist.routes";
import customerRoutes from "./customer/customer.routes";
import mediaRoutes from "./media/media.routes";

const router = Router();

router.use("/", authRoutes);
router.use("/", customerRoutes);
router.use("/", artistRoutes);
router.use("/", adminRoutes);
router.use("/", mediaRoutes);

export default router;
