import { Router } from 'express';
import { unlockRequestController } from '../../controllers/unlockRequestController';
import { verifyFirebaseToken } from '../../middleware/authMiddleware';

const router = Router();

router.use(verifyFirebaseToken);

/**
 * @swagger
 * /api/unlock-requests/pending:
 *   get:
 *     summary: Lấy danh sách yêu cầu mở khóa đang chờ xử lý
 *     tags:
 *       - UnlockRequests
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tripId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của chuyến xe
 *       - in: query
 *         name: roundId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của chặng
 *     responses:
 *       200:
 *         description: Danh sách yêu cầu mở khóa đang chờ
 *       400:
 *         description: Thiếu mã chuyến xe hoặc mã chặng
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi hệ thống
 */
router.get('/pending', unlockRequestController.getPendingRequests);

/**
 * @swagger
 * /api/unlock-requests/bus/{busId}/round/{roundId}:
 *   post:
 *     summary: Gửi yêu cầu mở khóa điểm danh cho một xe và chặng
 *     tags:
 *       - UnlockRequests
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: busId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của xe
 *       - in: path
 *         name: roundId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của chặng
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [check_in, check_out]
 *                 example: check_in
 *               reason:
 *                 type: string
 *                 example: Cần sửa dữ liệu điểm danh
 *     responses:
 *       201:
 *         description: Gửi yêu cầu mở khóa thành công
 *       400:
 *         description: Thiếu thông tin hoặc chặng đã hoàn thành
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy xe hoặc chặng
 *       409:
 *         description: Yêu cầu đang chờ đã tồn tại
 *       500:
 *         description: Lỗi hệ thống
 */
router.post('/bus/:busId/round/:roundId', unlockRequestController.create);

/**
 * @swagger
 * /api/unlock-requests/{requestId}/approve:
 *   post:
 *     summary: Duyệt yêu cầu mở khóa
 *     tags:
 *       - UnlockRequests
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của yêu cầu mở khóa
 *     responses:
 *       200:
 *         description: Duyệt yêu cầu thành công
 *       400:
 *         description: Thiếu mã yêu cầu hoặc yêu cầu đã được xử lý
 *       401:
 *         description: Không có quyền truy cập
 *       403:
 *         description: Từ chối truy cập
 *       404:
 *         description: Không tìm thấy yêu cầu mở khóa
 *       500:
 *         description: Lỗi hệ thống
 */
router.post('/:requestId/approve', unlockRequestController.approve);

/**
 * @swagger
 * /api/unlock-requests/{requestId}/reject:
 *   post:
 *     summary: Từ chối yêu cầu mở khóa
 *     tags:
 *       - UnlockRequests
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của yêu cầu mở khóa
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rejectReason:
 *                 type: string
 *                 example: Dữ liệu đã được xác nhận đúng
 *     responses:
 *       200:
 *         description: Từ chối yêu cầu thành công
 *       400:
 *         description: Thiếu mã yêu cầu hoặc yêu cầu đã được xử lý
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy yêu cầu mở khóa
 *       500:
 *         description: Lỗi hệ thống
 */
router.post('/:requestId/reject', unlockRequestController.reject);

export default router;
