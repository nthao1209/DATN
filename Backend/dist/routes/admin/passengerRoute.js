"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const authMiddleware_1 = require("../../middleware/authMiddleware");
const passengerController_1 = require("../../controllers/passengerController");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});
/**
 * @swagger
 * /api/trips/{tripId}/passengers:
 *   get:
 *     summary: Lấy danh sách hành khách theo chuyến
 *     tags:
 *       - Passengers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của chuyến xe
 *       - in: query
 *         name: busId
 *         required: false
 *         schema:
 *           type: integer
 *         description: Lọc theo ID xe
 *       - in: query
 *         name: scope
 *         required: false
 *         schema:
 *           type: string
 *         description: Phạm vi lấy dữ liệu, ví dụ attendance
 *       - in: query
 *         name: keyword
 *         required: false
 *         schema:
 *           type: string
 *         description: Từ khóa tìm theo tên hành khách
 *     responses:
 *       200:
 *         description: Danh sách hành khách
 *       400:
 *         description: Thiếu thông tin chuyến xe hoặc busId không hợp lệ
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi hệ thống
 */
router.get('/trips/:tripId/passengers', authMiddleware_1.verifyFirebaseToken, passengerController_1.passengerController.getAll);
/**
 * @swagger
 * /api/trips/{tripId}/passengers:
 *   post:
 *     summary: Tạo hành khách mới trong chuyến
 *     tags:
 *       - Passengers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
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
 *             required:
 *               - name
 *               - busId
 *             properties:
 *               name:
 *                 type: string
 *                 example: Nguyễn Văn A
 *               tel:
 *                 type: string
 *                 example: "0901234567"
 *               note:
 *                 type: string
 *                 example: Ghi chú hành khách
 *               busId:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Tạo hành khách thành công
 *       400:
 *         description: Thiếu tên, thiếu mã xe hoặc thiếu thông tin chuyến xe
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy xe
 *       500:
 *         description: Lỗi hệ thống
 */
router.post('/trips/:tripId/passengers', authMiddleware_1.verifyFirebaseToken, passengerController_1.passengerController.create);
/**
 * @swagger
 * /api/trips/{tripId}/passengers/import-sheets:
 *   post:
 *     summary: Đọc danh sách sheet từ file Excel import hành khách
 *     tags:
 *       - Passengers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của chuyến xe
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File Excel cần đọc sheet
 *     responses:
 *       200:
 *         description: Trả về danh sách sheet trong file
 *       400:
 *         description: Thiếu chuyến xe hoặc chưa chọn file Excel
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi hệ thống
 */
router.post('/trips/:tripId/passengers/import-sheets', authMiddleware_1.verifyFirebaseToken, upload.single('file'), passengerController_1.passengerController.getImportSheets);
/**
 * @swagger
 * /api/trips/{tripId}/passengers/import-preview:
 *   post:
 *     summary: Xem trước dữ liệu hành khách từ file Excel
 *     tags:
 *       - Passengers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của chuyến xe
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - sheetName
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File Excel cần xem trước
 *               sheetName:
 *                 type: string
 *                 example: Sheet1
 *     responses:
 *       200:
 *         description: Trả về dữ liệu preview, số dòng import và các xe chưa khớp
 *       400:
 *         description: Thiếu chuyến xe, chưa chọn file hoặc không tìm thấy sheet
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi hệ thống
 */
router.post('/trips/:tripId/passengers/import-preview', authMiddleware_1.verifyFirebaseToken, upload.single('file'), passengerController_1.passengerController.importPreview);
/**
 * @swagger
 * /api/passengers/{id}:
 *   put:
 *     summary: Cập nhật thông tin hành khách
 *     tags:
 *       - Passengers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của hành khách
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               tel:
 *                 type: string
 *               note:
 *                 type: string
 *               busId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Cập nhật hành khách thành công
 *       400:
 *         description: Mã xe không hợp lệ
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy hành khách hoặc xe
 *       500:
 *         description: Lỗi hệ thống
 */
router.put('/passengers/:id', authMiddleware_1.verifyFirebaseToken, passengerController_1.passengerController.update);
/**
 * @swagger
 * /api/passengers/{id}:
 *   delete:
 *     summary: Xóa hành khách
 *     tags:
 *       - Passengers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của hành khách
 *     responses:
 *       200:
 *         description: Xóa hành khách thành công
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy hành khách
 *       500:
 *         description: Lỗi hệ thống
 */
router.delete('/passengers/:id', authMiddleware_1.verifyFirebaseToken, passengerController_1.passengerController.delete);
exports.default = router;
