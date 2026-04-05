"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPasswordResetEmail = exports.sendJoinCodeEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const transporter = nodemailer_1.default.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASSWORD || 'your-app-password'
    }
});
const sendJoinCodeEmail = async (email, joinCode, organizationName) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER || 'your-email@gmail.com',
            to: email,
            subject: `Mã tham gia tổ chức ${organizationName}`,
            html: `
        <h2>Chào mừng!</h2>
        <p>Bạn vừa được thêm vào tổ chức <strong>${organizationName}</strong></p>
        <p>Mã tham gia: <strong style="font-size: 24px; color: #007bff;">${joinCode}</strong></p>
        <p>Vul lòng sử dụng mã này để tham gia tổ chức trong ứng dụng.</p>
        <p>Trân trọng,<br/>Đội ngũ ứng dụng</p>
      `
        };
        await transporter.sendMail(mailOptions);
        console.log(`Email gửi thành công đến ${email}`);
        return true;
    }
    catch (error) {
        console.error('Lỗi gửi email:', error);
        throw error;
    }
};
exports.sendJoinCodeEmail = sendJoinCodeEmail;
const sendPasswordResetEmail = async (email, resetLink) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER || 'your-email@gmail.com',
            to: email,
            subject: 'Đặt lại mật khẩu',
            html: `
        <h2>Đặt lại mật khẩu</h2>
        <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
        <p><a href="${resetLink}">Nhấp vào đây để đặt lại mật khẩu</a></p>
        <p>Nếu bạn không yêu cầu điều này, vui lòng bỏ qua email này.</p>
        <p>Trân trọng,<br/>Đội ngũ ứng dụng</p>
      `
        };
        await transporter.sendMail(mailOptions);
        console.log(`Email đặt lại mật khẩu gửi thành công đến ${email}`);
        return true;
    }
    catch (error) {
        console.error('Lỗi gửi email đặt lại mật khẩu:', error);
        throw error;
    }
};
exports.sendPasswordResetEmail = sendPasswordResetEmail;
