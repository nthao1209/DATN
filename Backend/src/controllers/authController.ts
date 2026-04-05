import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../types/auth";
import { Response } from "express";
import admin from "../config/firebaseAdmin";

const prisma = new PrismaClient();

export const syncUser = async (req: AuthRequest, res: Response) =>{
  const {email, firebaseUid, name} = req.body;
  try{
    const user = await prisma.user.upsert({
      where: {firebaseUid: firebaseUid},
      update: {email, name},
      create: {
        email,
        name,
        firebaseUid,
      },
    });
    return res.status(200).json(user);
  }catch(error){
    return res.status(500).json({ error: "Không thể đồng bộ User" });
  }
}

export const getMyStatus = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  const userTenants = await prisma.userTenant.findMany({
    where: { userId },
    include: {
      tenant: true,
      role: true
    }
  });

  res.json({
    user: req.user,
    tenants: userTenants.map(ut => ({
      ...ut.tenant,
      role: ut.role.name
    }))
  });
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const firebaseUid = req.user?.firebaseUid;

  if (!userId || !firebaseUid) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    await admin.auth().deleteUser(firebaseUid);
    console.log(`Đã xóa user Firebase: ${firebaseUid}`);

    await prisma.userTenant.deleteMany({
      where: { userId }
    });

    await prisma.user.delete({
      where: { id: userId }
    });

    res.json({
      message: "Tài khoản đã được xóa thành công"
    });
  } catch (error: any) {
    console.error("Lỗi xóa user:", error);
    res.status(500).json({ message: "Lỗi server khi xóa tài khoản" });
  }
};