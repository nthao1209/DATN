import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import swaggerUi from 'swagger-ui-express';
import publicRoutes from './routes/public';
import adminRoutes from './routes/admin';
import systemAdminRoutes from './routes/system-admin';
import busManagementRoutes from './routes/bus-management';
import { swaggerSpec } from './config/swagger';
dotenv.config()

const app = express()

// Middleware nền cho toàn bộ API: cho phép frontend gọi cross-origin và đọc body JSON.
app.use(cors())
app.use(express.json())
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// Gom route theo nhóm quyền/ngữ cảnh để controller phía dưới chỉ tập trung xử lý nghiệp vụ.
app.use('/api', publicRoutes);
app.use('/api', adminRoutes);
app.use('/api', systemAdminRoutes);
app.use('/api', busManagementRoutes);

// Endpoint nhẹ để kiểm tra server còn sống, thường dùng cho deploy/monitor.
app.get("/health", (_req, res) => {
  res.status(200).send("ok");
});

// Endpoint debug nội bộ: liệt kê các route được mount trực tiếp trong Express app.
app.get('/api/_routes', (_req, res) => {
  try {
    const routes: string[] = (app as any)._router.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => {
        const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
        return `${methods} ${layer.route.path}`;
      });
    res.json({ routes });
  } catch (err) {
    res.status(500).json({ message: 'Failed to enumerate routes' });
  }
});

const PORT = process.env.PORT || 5001

// Bắt đầu lắng nghe request HTTP.
app.listen(PORT, () => {
})
