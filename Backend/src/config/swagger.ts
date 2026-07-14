import 'dotenv/config';
import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';

const swaggerServerUrl =
  process.env.SWAGGER_SERVER_URL ||
  process.env.BACKEND_URL || `http://localhost:${process.env.PORT}`;

const tagOrder = [
  'Auth',
  'Tenants',
  'Notifications',
  'Trips',
  'Rounds',
  'Buses',
  'Passengers',
  'Transactions',
  'UnlockRequests',
  'Users',
  'Roles',
];

const methodOrder = ['get', 'post', 'put', 'patch', 'delete'];

const getTagIndex = (tagName?: string) => {
  const index = tagOrder.indexOf(tagName || '');
  return index === -1 ? tagOrder.length : index;
};

const getFirstOperation = (pathItem: Record<string, any>) =>
  methodOrder
    .map((method) => pathItem[method])
    .find((operation) => operation);

const sortSwaggerPaths = (spec: any) => {
  const paths = spec.paths || {};
  const sortedPaths = Object.entries(paths).sort(([pathA, pathItemA], [pathB, pathItemB]) => {
    const operationA = getFirstOperation(pathItemA as Record<string, any>);
    const operationB = getFirstOperation(pathItemB as Record<string, any>);
    const tagDiff =
      getTagIndex(operationA?.tags?.[0]) - getTagIndex(operationB?.tags?.[0]);

    if (tagDiff !== 0) return tagDiff;

    return pathA.localeCompare(pathB);
  });

  spec.paths = Object.fromEntries(
    sortedPaths.map(([path, pathItem]) => {
      const sortedMethods = Object.entries(pathItem as Record<string, any>).sort(
        ([methodA], [methodB]) =>
          methodOrder.indexOf(methodA) - methodOrder.indexOf(methodB)
      );

      return [path, Object.fromEntries(sortedMethods)];
    })
  );

  return spec;
};

export const swaggerSpec = sortSwaggerPaths(swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DATN Backend API',
      version: '1.0.0',
      description: 'Tài liệu API cho backend DATN',
    },
    tags: [
      {
        name: 'Auth',
        description: 'Xác thực và trạng thái tài khoản',
      },
      {
        name: 'Tenants',
        description: 'Tổ chức và mã tham gia',
      },
      {
        name: 'Notifications',
        description: 'Thông báo của người dùng',
      },
      {
        name: 'Trips',
        description: 'Quản lý chuyến xe',
      },
      {
        name: 'Rounds',
        description: 'Quản lý chặng trong chuyến',
      },
      {
        name: 'Buses',
        description: 'Quản lý xe và trạng thái xe theo chặng',
      },
      {
        name: 'Passengers',
        description: 'Quản lý hành khách và import preview Excel',
      },
      {
        name: 'Transactions',
        description: 'Bảng điểm danh',
      },
      {
        name: 'UnlockRequests',
        description: 'Yêu cầu mở khóa điểm danh',
      },
      {
        name: 'Users',
        description: 'Quản lý người dùng hệ thống',
      },
      {
        name: 'Roles',
        description: 'Quản lý vai trò',
      },
    ],
    servers: [
      {
        url: swaggerServerUrl,
        description: 'Máy chủ API',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'Firebase JWT',
          description: 'Nhập Firebase ID token theo dạng: Bearer <token>',
        },
      },
      schemas: {
        MessageResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Thao tác thành công',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Lỗi hệ thống',
            },
          },
        },
      },
    },
  },
  apis: [
    path.join(__dirname, '../routes/**/*.js'),
    path.join(__dirname, '../../src/routes/**/*.ts'),
  ],
}));
