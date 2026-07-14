"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../../middleware/authMiddleware");
const busController_1 = require("../../controllers/busController");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/trips/{tripId}/buses:
 *   get:
 *     summary: Lấy danh sách xe theo chuyến
 *     tags:
 *       - Buses
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của chuyến xe
 *     responses:
 *       200:
 *         description: Danh sách xe của chuyến
 *       400:
 *         description: Thiếu thông tin chuyến xe
 *       401:
 *         description: Không có quyền truy cập
 */
router.get('/trips/:tripId/buses', authMiddleware_1.verifyFirebaseToken, busController_1.busController.getAll);
/**
 * @swagger
 * /api/trips/{tripId}/buses:
 *   post:
 *     summary: Tạo xe mới trong chuyến
 *     tags:
 *       - Buses
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
 *               - busCode
 *             properties:
 *               registrationNumber:
 *                 type: string
 *                 nullable: true
 *                 description: Biển số xe, không bắt buộc
 *                 example: 51A-12345
 *               busCode:
 *                 type: string
 *                 description: Mã xe trong chuyến, bắt buộc và không được trùng trong cùng chuyến
 *                 example: BUS01
 *               driverName:
 *                 type: string
 *                 nullable: true
 *                 description: Tên tài xế, không bắt buộc
 *                 example: Nguyễn Văn B
 *               driverTel:
 *                 type: string
 *                 nullable: true
 *                 description: Số điện thoại tài xế, không bắt buộc
 *                 example: "0901234567"
 *               tourGuideName:
 *                 type: string
 *                 nullable: true
 *                 description: Tên hướng dẫn viên, không bắt buộc
 *                 example: Trần Thị C
 *               tourGuideTel:
 *                 type: string
 *                 nullable: true
 *                 description: Số điện thoại hướng dẫn viên, không bắt buộc
 *                 example: "0912345678"
 *               description:
 *                 type: string
 *                 nullable: true
 *                 description: Mô tả thêm về xe, không bắt buộc
 *                 example: Xe 45 chỗ
 *               managerId:
 *                 type: integer
 *                 nullable: true
 *                 description: ID người quản lý xe, không bắt buộc
 *                 example: 3
 *           examples:
 *             minimal:
 *               summary: Tạo xe với thông tin tối thiểu
 *               value:
 *                 busCode: BUS01
 *             full:
 *               summary: Tạo xe với đầy đủ thông tin tùy chọn
 *               value:
 *                 registrationNumber: 51A-12345
 *                 busCode: BUS01
 *                 driverName: Nguyễn Văn B
 *                 driverTel: "0901234567"
 *                 tourGuideName: Trần Thị C
 *                 tourGuideTel: "0912345678"
 *                 description: Xe 45 chỗ
 *                 managerId: 3
 *     responses:
 *       201:
 *         description: Tạo xe thành công
 *       400:
 *         description: Thiếu thông tin bắt buộc hoặc mã xe đã tồn tại
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Không thể lưu xe
 */
router.post('/trips/:tripId/buses', authMiddleware_1.verifyFirebaseToken, busController_1.busController.create);
/**
 * @swagger
 * /api/busManagers:
 *   get:
 *     summary: Lấy danh sách người quản lý xe
 *     tags:
 *       - Buses
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách user có vai trò quản lý xe trong tổ chức
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi hệ thống
 */
router.get('/busManagers', authMiddleware_1.verifyFirebaseToken, busController_1.busController.getBusManagers);
/**
 * @swagger
 * /api/buses/{id}:
 *   put:
 *     summary: Cập nhật thông tin xe
 *     tags:
 *       - Buses
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của xe
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - busCode
 *             properties:
 *               registrationNumber:
 *                 type: string
 *                 nullable: true
 *                 description: Biển số xe, không bắt buộc
 *               busCode:
 *                 type: string
 *                 description: Mã xe trong chuyến, bắt buộc và không được trùng trong cùng chuyến
 *                 example: BUS01
 *               driverName:
 *                 type: string
 *                 nullable: true
 *                 description: Tên tài xế, không bắt buộc
 *               driverTel:
 *                 type: string
 *                 nullable: true
 *                 description: Số điện thoại tài xế, không bắt buộc
 *               tourGuideName:
 *                 type: string
 *                 nullable: true
 *                 description: Tên hướng dẫn viên, không bắt buộc
 *               tourGuideTel:
 *                 type: string
 *                 nullable: true
 *                 description: Số điện thoại hướng dẫn viên, không bắt buộc
 *               description:
 *                 type: string
 *                 nullable: true
 *                 description: Mô tả thêm về xe, không bắt buộc
 *               managerId:
 *                 type: integer
 *                 nullable: true
 *                 description: ID người quản lý xe, không bắt buộc
 *           examples:
 *             minimal:
 *               summary: Cập nhật xe với thông tin tối thiểu
 *               value:
 *                 busCode: BUS01
 *             full:
 *               summary: Cập nhật xe với đầy đủ thông tin tùy chọn
 *               value:
 *                 registrationNumber: 51A-12345
 *                 busCode: BUS01
 *                 driverName: Nguyễn Văn B
 *                 driverTel: "0901234567"
 *                 tourGuideName: Trần Thị C
 *                 tourGuideTel: "0912345678"
 *                 description: Xe 45 chỗ
 *                 managerId: 3
 *     responses:
 *       200:
 *         description: Cập nhật xe thành công
 *       400:
 *         description: Thiếu ID, thiếu thông tin bắt buộc hoặc mã xe đã tồn tại
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy xe
 *       500:
 *         description: Không thể lưu xe
 */
router.put('/buses/:id', authMiddleware_1.verifyFirebaseToken, busController_1.busController.update);
/**
 * @swagger
 * /api/buses/{id}:
 *   delete:
 *     summary: Xóa xe
 *     tags:
 *       - Buses
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của xe
 *     responses:
 *       200:
 *         description: Xóa xe thành công
 *       400:
 *         description: Thiếu thông tin xe
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy xe
 *       500:
 *         description: Lỗi hệ thống
 */
router.delete('/buses/:id', authMiddleware_1.verifyFirebaseToken, busController_1.busController.delete);
/**
 * @swagger
 * /api/bus-round-status:
 *   get:
 *     summary: Lấy trạng thái khóa và xác nhận của xe theo chặng
 *     tags:
 *       - Buses
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tripId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của chuyến xe
 *     responses:
 *       200:
 *         description: Danh sách trạng thái bus-round
 *       400:
 *         description: Thiếu thông tin chuyến xe
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi hệ thống
 */
router.get('/bus-round-status', authMiddleware_1.verifyFirebaseToken, busController_1.busController.getRoundStatuses);
/**
 * @swagger
 * /api/buses/{busId}/rounds/{roundId}/confirm-checks:
 *   post:
 *     summary: Khóa hoặc mở khóa lượt đi/lượt về của một xe trong một chặng
 *     tags:
 *       - Buses
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               checkInLocked:
 *                 type: boolean
 *                 example: true
 *               checkOutLocked:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái khóa thành công
 *       400:
 *         description: Thiếu thông tin xe hoặc chặng
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy xe
 *       409:
 *         description: Lượt đã được khóa trước đó
 *       500:
 *         description: Lỗi hệ thống
 */
router.post('/buses/:busId/rounds/:roundId/confirm-checks', authMiddleware_1.verifyFirebaseToken, busController_1.busController.confirmChecks);
/**
 * @swagger
 * /api/buses/{busId}/rounds/{roundId}/confirm-completion:
 *   post:
 *     summary: Tài xế xác nhận xe đã hoàn thành chặng
 *     tags:
 *       - Buses
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
 *     responses:
 *       200:
 *         description: Xác nhận hoàn thành chặng thành công
 *       400:
 *         description: Thiếu thông tin hoặc chưa khóa đủ lượt đi/lượt về
 *       401:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy xe hoặc chặng
 *       500:
 *         description: Lỗi hệ thống
 */
router.post('/buses/:busId/rounds/:roundId/confirm-completion', authMiddleware_1.verifyFirebaseToken, busController_1.busController.confirmCompletion);
exports.default = router;
