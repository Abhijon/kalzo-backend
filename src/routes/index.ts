import { Router } from "express";
import authRoutes from "./auth/auth.routes";
import customerRoutes from "./customer/customer.routes";

const router = Router();

router.use("/", authRoutes);
router.use("/", customerRoutes);

export default router;
