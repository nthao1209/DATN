import { Router } from 'express';
import { syncUser, getMyStatus, deleteUser } from '../../controllers/authController';
import { verifyFirebaseTokenOnly, verifyVerifiedFirebaseTokenOnly, verifyFirebaseToken } from '../../middleware/authMiddleware';

const router = Router();

/**
 * @swagger
 * /api/auth/sync:
 *   post:
 *     summary: Đồng bộ tài khoản Firebase vào hệ thống
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - firebaseUid
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               firebaseUid:
 *                 type: string
 *                 example: firebase_uid_123
 *               name:
 *                 type: string
 *                 example: Nguyễn Văn A
 *     responses:
 *       200:
 *         description: Đồng bộ user thành công
 *       400:
 *         description: Thiếu email hoặc firebaseUid
 *       500:
 *         description: Không thể đồng bộ user
 */
router.post('/auth/sync', verifyFirebaseTokenOnly, syncUser);

/**
 * @swagger
 * /api/auth/status:
 *   get:
 *     summary: Lấy trạng thái đăng nhập và danh sách tổ chức của user
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trả về thông tin user, role và tenant
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi hệ thống
 */
router.get('/auth/status', verifyVerifiedFirebaseTokenOnly, getMyStatus);

/**
 * @swagger
 * /api/auth/delete-account:
 *   delete:
 *     summary: Vô hiệu hóa tài khoản hiện tại
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tài khoản đã bị vô hiệu hóa thành công
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy tài khoản
 *       500:
 *         description: Lỗi server khi vô hiệu hóa tài khoản
 */
router.delete('/auth/delete-account', verifyFirebaseToken, deleteUser);

export default router;
