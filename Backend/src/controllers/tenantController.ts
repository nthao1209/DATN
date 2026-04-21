import {Response} from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthRequest } from '../types/auth'
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

export const generateJoinCode = () =>{
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  let code = '';

  for (let i = 0; i < 6; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }

  return code;
}

export const generateUniqueJoinCode = async() : Promise<string> =>{
  let code: string;
  let exists = true;
  while (exists) {
    code = generateJoinCode();
    const tenant = await prisma.tenant.findUnique({
      where: {joinCode: code},
    });

    if(!tenant) exists = false
  }
  return code!;
}

export const createTenant = async (req:AuthRequest,res: Response) => {
  const user = req.user;
  const {name} = req.body;

   if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!name) {
    return res.status(400).json({ message: "Thiếu tên tổ chức" });
  }

  try{
    const joinCode = await generateUniqueJoinCode();

    const tenant = await prisma.tenant.create({
      data: {
        name,
        joinCode,
      },
    });

    await prisma.userTenant.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        roleId:2,
      },
    });
     return res.json({
      message: "Tạo tổ chức thành công",
      tenant: {
        ...tenant,
        joinCode: joinCode
      },
      joinCode: joinCode
    });
  }catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Lỗi server" });
  }
};


export const joinTenant = async (req: AuthRequest,res:Response) =>{
  const {joinCode} = req.body;
  const user = req.user;

  if(!user) return res.status(401).json({message:"User not identified"});

  try{
    const tenant = await prisma.tenant.findUnique({
      where: {joinCode}
    });

    if(!tenant) return res.status(400).json({message:"Not information"});

    const membership = await prisma.userTenant.create({
      data: {
        userId : user.id,
        tenantId: tenant.id,
        roleId: 3
      }
    });
    res.json({message:"Succesful",tenant});
  }catch(error){
    res.status(400).json({message:"Bạn đã là thành viên của tổ chức này"})
  }
}

