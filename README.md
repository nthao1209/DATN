# Hệ thống quản lý điểm danh khách trên xe

Dự án gồm 3 thành phần chính:

- `Backend`: API Express/TypeScript, quản lý người dùng, phân quyền, chuyến đi, xe, hành khách, vòng điểm danh và đồng bộ dữ liệu với PostgreSQL thông qua Prisma.
- `Frontend`: ứng dụng React + Vite cho các màn hình đăng nhập, quản trị hệ thống, quản lý chuyến/xe và điểm danh.
- `Mqtt-worker`: tiến trình nền đọc bản tin MQTT điểm danh, xử lý theo file cấu hình và cập nhật dữ liệu vào PostgreSQL.

## Cấu trúc thư mục

```text
DATN/
|-- Backend/       # API, Prisma schema, seed data, build output
|-- Frontend/      # React/Vite app
|-- Mqtt-worker/   # MQTT worker, cấu hình topic và kết nối database
`-- README.md      # Tài liệu tổng quan dự án
```

## Yêu cầu môi trường

- Node.js 20 trở lên
- npm
- PostgreSQL
- MQTT broker
- Firebase project và service account nếu dùng xác thực Firebase

## Cài đặt

Cài dependency cho từng thành phần:

```bash
cd Backend
npm install

cd ../Frontend
npm install

cd ../Mqtt-worker
npm install
```

## Cấu hình biến môi trường

Mỗi thành phần có file `.env` riêng. Có thể tạo từ các biến đang được sử dụng trong source:

### Backend/.env

```env
SUPERADMIN_EMAIL=
SUPERADMIN_UID=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
MQTT_URL=
MQTT_USERNAME=
MQTT_PASSWORD=
PORT=5000
DATABASE_URL=postgresql://user:password@host:5432/database
```

### Frontend/.env

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_MQTT_WS_URL=
VITE_MQTT_USERNAME=
VITE_MQTT_PASSWORD=
VITE_MQTT_UI_TOPIC_PREFIX=
VITE_APPS_SCRIPT_URL=
VITE_API_URL=http://localhost:5000
```

### Mqtt-worker/.env

```env
NODE_ENV=development
CONFIG_PATH=./configs/transaction.config.json
```

File `Mqtt-worker/configs/transaction.config.json` chứa cấu hình MQTT, PostgreSQL, topic và cấu trúc dữ liệu. Khi deploy, nên đặt file cấu hình/secret ở ngoài repository và trỏ `CONFIG_PATH` đến file đó.

## Khởi tạo database

Từ thư mục `Backend`:

```bash
npm run prisma:generate
npm run prisma:migrate:dev
npm run db:seed
```

Khi deploy production, dùng:

```bash
npm run prisma:deploy
```

## Chạy môi trường phát triển

Mở 3 terminal riêng:

```bash
cd Backend
npm run dev
```

```bash
cd Frontend
npm run dev
```

```bash
cd Mqtt-worker
npm run dev
```

Mặc định:

- Backend chạy tại `http://localhost:5000`
- Frontend Vite chạy tại `http://localhost:5173`
- Mqtt-worker đọc cấu hình từ `CONFIG_PATH` hoặc `configs/transaction.config.json`

Có thể kiểm tra API bằng endpoint:

```text
GET http://localhost:5000/health
```

## Build và chạy production

### Backend

```bash
cd Backend
npm run build
npm start
```

### Frontend

```bash
cd Frontend
npm run build
npm run preview
```

### Mqtt-worker

```bash
cd Mqtt-worker
npm run build
npm start
```

Nếu dùng PM2 cho worker:

```bash
cd Mqtt-worker
npm run pm2
```

## Ghi chú bảo mật

- Không commit `.env`, service account, mật khẩu MQTT/PostgreSQL hoặc file config production có secret.
- Nên dùng biến môi trường hoặc secret manager khi deploy.
- Nếu thông tin đăng nhập đã từng được commit, hãy đổi mật khẩu/token trước khi đưa hệ thống lên môi trường thật.
