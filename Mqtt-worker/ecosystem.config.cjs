module.exports = {
  apps: [
    {
      name: "mqtt-worker",
      script: "./dist/master.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production" // Chế độ production sẽ tắt các log chi tiết mqtt
      },
      // Tự động khởi động lại nếu app dùng quá 300MB RAM
      max_memory_restart: "300M",
      // Cấu hình log
      error_file: "./logs/mqtt-worker.err.log",
      out_file: "./logs/mqtt-worker.out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    }
  ]
};