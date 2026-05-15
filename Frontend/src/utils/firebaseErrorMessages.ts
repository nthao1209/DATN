/**
 * Firebase Error Messages in Vietnamese
 * Maps Firebase error codes to user-friendly Vietnamese messages
 */

interface FirebaseErrorMap {
  [key: string]: string;
}

const FIREBASE_AUTH_ERRORS: FirebaseErrorMap = {
  'auth/invalid-credential': 'Email hoặc mật khẩu không chính xác',
  'auth/user-not-found': 'Tài khoản không tồn tại',
  'auth/wrong-password': 'Mật khẩu không chính xác',
  'auth/email-already-in-use': 'Email này đã được đăng ký',
  'auth/weak-password': 'Mật khẩu quá yếu (tối thiểu 6 ký tự)',
  'auth/invalid-email': 'Email không hợp lệ',
  'auth/user-disabled': 'Tài khoản này đã bị vô hiệu hóa',
  'auth/too-many-requests': 'Quá nhiều lần thử. Vui lòng thử lại sau',
  'auth/operation-not-allowed': 'Hoạt động này không được phép',
  
  'auth/invalid-verification-code': 'Mã xác thực không hợp lệ',
  'auth/expired-action-code': 'Mã xác thực đã hết hạn',
  
  // Password reset errors
  'auth/invalid-action-code': 'Liên kết reset mật khẩu không hợp lệ hoặc đã hết hạn',
  'auth/missing-email': 'Email là bắt buộc',
  'auth/missing-password': 'Mật khẩu là bắt buộc',
  
  // Network and system errors
  'auth/network-request-failed': 'Lỗi kết nối. Vui lòng kiểm tra kết nối internet',
  'auth/internal-error': 'Lỗi hệ thống. Vui lòng thử lại sau',
  'auth/invalid-api-key': 'Cấu hình Firebase không hợp lệ',
  'auth/app-not-initialized': 'Ứng dụng chưa được khởi tạo',
  
  // Multi-factor authentication errors
  'auth/multi-factor-auth-required': 'Xác thực đa yếu tố được yêu cầu',
  'auth/invalid-multi-factor-session': 'Phiên xác thực đa yếu tố không hợp lệ',
  
  // Additional common errors
  'auth/account-exists-with-different-credential': 'Tài khoản đã tồn tại với thông tin đăng nhập khác',
  'auth/requires-recent-login': 'Cần phải đăng nhập lại để thực hiện tác vụ này',
  'auth/credential-already-in-use': 'Thông tin đăng nhập này đã được sử dụng',
  'auth/invalid-credential-structure': 'Thông tin đăng nhập không hợp lệ',
};

/**
 * Get Vietnamese error message from Firebase error
 * @param error - Firebase error object or string
 * @returns Vietnamese error message
 */
export function getFirebaseErrorMessage(error: any): string {
  let errorCode = '';
  let errorMessage = '';

  // Extract error code from different error formats
  if (typeof error === 'string') {
    // Try to extract code from error message like "Firebase: Error (auth/invalid-credential)"
    const match = error.match(/auth\/[\w-]+/);
    if (match) {
      errorCode = match[0];
    }
    errorMessage = error;
  } else if (error?.code) {
    errorCode = error.code;
    errorMessage = error.message || '';
  } else if (error?.message) {
    const match = error.message.match(/auth\/[\w-]+/);
    if (match) {
      errorCode = match[0];
    }
    errorMessage = error.message;
  }

  // Return Vietnamese translation if available, otherwise return original message
  if (errorCode && FIREBASE_AUTH_ERRORS[errorCode]) {
    return FIREBASE_AUTH_ERRORS[errorCode];
  }

  // Fallback for unknown errors
  if (errorMessage) {
    return errorMessage;
  }

  return 'Đã xảy ra lỗi không xác định. Vui lòng thử lại';
}

/**
 * Get specific Firebase error code
 * @param error - Firebase error object or string
 * @returns Firebase error code or null
 */
export function getFirebaseErrorCode(error: any): string | null {
  if (typeof error === 'string') {
    const match = error.match(/auth\/[\w-]+/);
    return match ? match[0] : null;
  } else if (error?.code) {
    return error.code;
  } else if (error?.message) {
    const match = error.message.match(/auth\/[\w-]+/);
    return match ? match[0] : null;
  }
  return null;
}

export default FIREBASE_AUTH_ERRORS;
