import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'your-app-password'
  }
});

export const sendJoinCodeEmail = async (email: string, joinCode: string, organizationName: string) => {
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
  } catch (error) {
    console.error('Lỗi gửi email:', error);
    throw error;
  }
};

export const sendPasswordResetEmail = async (email: string, resetLink: string) => {
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
  } catch (error) {
    console.error('Lỗi gửi email đặt lại mật khẩu:', error);
    throw error;
  }
};
