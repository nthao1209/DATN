
```plain
mqtt-worker/
├── configs/                # Chứa các file duan_01.config.json...
├── src/                    # Chứa mã nguồn TypeScript
│   ├── types.ts            # Định nghĩa Interface
│   ├── master.ts           # Trình điều phối chính
│   └── worker.ts           # Logic xử lý từng dự án
├── dist/                   # Chứa file Javascript sau khi biên dịch (tự sinh)
├── package.json
├── tsconfig.json           # Cấu hình TypeScript
└── .gitignore
```