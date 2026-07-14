import { Router } from 'express';
import { verifyFirebaseToken } from '../../middleware/authMiddleware';
import { tripController } from '../../controllers/tripController';

const router = Router();

/**
 * @swagger
 * /api/trips:
 *   get:
 *     summary: Lấy danh sách chuyến xe của tổ chức hiện tại
 *     tags:
 *       - Trips
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách chuyến xe
 *       400:
 *         description: Thiếu thông tin tổ chức
 */
router.get('/trips', verifyFirebaseToken, tripController.getAll);

/**
 * @swagger
 * /api/trips:
 *   post:
 *     summary: Tạo chuyến xe mới
 *     tags:
 *       - Trips
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Chuyến tham quan Đà Lạt
 *               status:
 *                 type: string
 *                 enum: [DOING, DONE]
 *                 example: DOING
 *     responses:
 *       201:
 *         description: Tạo chuyến xe thành công
 *       400:
 *         description: Thiếu thông tin tổ chức
 */
router.post('/trips', verifyFirebaseToken, tripController.create);

/**
 * @swagger
 * /api/trips/{id}:
 *   put:
 *     summary: Cập nhật chuyến xe
 *     tags:
 *       - Trips
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của chuyến xe
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Chuyến tham quan Đà Lạt
 *               status:
 *                 type: string
 *                 enum: [DOING, DONE]
 *                 example: DONE
 *     responses:
 *       200:
 *         description: Cập nhật chuyến xe thành công
 *       400:
 *         description: Chuyến chưa đủ điều kiện hoàn thành
 *       401:
 *         description: Thiếu thông tin tổ chức
 *       404:
 *         description: Không tìm thấy chuyến xe
 */
router.put('/trips/:id', verifyFirebaseToken, tripController.update);

/**
 * @swagger
 * /api/trips/{id}:
 *   delete:
 *     summary: Xóa chuyến xe
 *     tags:
 *       - Trips
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của chuyến xe
 *     responses:
 *       200:
 *         description: Xóa chuyến xe thành công
 *       400:
 *         description: Thiếu mã chuyến xe
 *       401:
 *         description: Thiếu thông tin tổ chức
 *       404:
 *         description: Không tìm thấy chuyến xe
 *       500:
 *         description: Không thể xóa chuyến xe
 */
router.delete('/trips/:id', verifyFirebaseToken, tripController.delete);

export default router;
