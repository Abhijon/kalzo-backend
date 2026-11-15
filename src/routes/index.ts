import { Router } from "express";
import authRoutes from "./auth/auth.routes";
import artistRoutes from "./artist/artist.routes";
import customerRoutes from "./customer/customer.routes";

const router = Router();

router.use("/", authRoutes);
router.use("/", customerRoutes);
router.use("/", artistRoutes);

export default router;
