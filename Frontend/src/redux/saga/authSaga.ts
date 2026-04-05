import { call, put, takeLatest } from 'redux-saga/effects';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from 'firebase/auth';
import { auth as fbAuth } from '../../config/firebase';
import { api } from '../../services/api'; // Import bộ api tổng hợp
import * as authActions from '../slice/authSlice';

function* handleLogin(action: any): any {
  try {
    const { email, password } = action.payload;
    
    // 1. Firebase xác thực
    const userCredential = yield call(signInWithEmailAndPassword, fbAuth, email.trim(), password);
    const user = userCredential.user;

    if (!user.emailVerified) {
      throw new Error("Email chưa được xác thực. Vui lòng kiểm tra hộp thư!");
    }
   
    const token = yield call([user, user.getIdToken]);

    // 2. Gọi API Status để lấy thông tin từ Postgres (Prisma) và kiểm tra Tenant
    // Lúc này axios interceptor sẽ tự động lấy token và đính kèm vào header
    const response = yield call(api.getMyStatus);

    yield put(authActions.authSuccess({
      user: response.user,
      token: token,
      tenants: response.tenants || []
    }));

  } catch (error: any) {
    yield put(authActions.authFailure(error.message));
  }
}

// ✅ XỬ LÝ ĐĂNG KÝ
function* handleRegister(action: any): any {
  try {
    const { email, password, name } = action.payload;

    // 1. Tạo trên Firebase
    const userCredential = yield call(createUserWithEmailAndPassword, fbAuth, email.trim(), password);
    const fbUser = userCredential.user;

    // 2. Gửi email xác nhận
    yield call(sendEmailVerification, fbUser);

    // 3. Đồng bộ ngay lập tức sang Postgres (Prisma)
    yield call(api.syncUser, {
      email: fbUser.email!,
      name: name,
      firebaseUid: fbUser.uid
    });

    yield put(authActions.registerSuccess("Đăng ký thành công! Hãy xác thực email trước khi đăng nhập."));
  } catch (error: any) {
    yield put(authActions.authFailure(error.message));
  }
}

// ✅ XỬ LÝ NHẬP MÃ JOIN CODE
function* handleJoinTenant(action: any): any {
  try {
    const joinCode = action.payload;
    
    // Gọi API join tenant
    const joinResponse = yield call(api.joinTenant, joinCode);
    const statusResponse = yield call(api.getMyStatus);
    const matchedTenant = statusResponse?.tenants?.find(
      (tenant: any) => tenant.id === joinResponse?.tenant?.id
    );

    // Nếu thành công, cập nhật state để vào Dashboard
    if (matchedTenant) {
      yield put(authActions.joinTenantSuccess(matchedTenant));
    } else if (joinResponse?.tenant) {
      yield put(authActions.joinTenantSuccess({ ...joinResponse.tenant, role: 'member' }));
    }
  } catch (error: any) {
    yield put(authActions.authFailure(error.message));
  }
}

// ✅ XỬ LÝ ĐĂNG XUẤT
function* handleLogout(): any {
  try {
    yield call(signOut, fbAuth);
    // Xóa các dữ liệu nhạy cảm nếu cần
  } catch (error: any) {
    console.error("Logout error", error);
  }
}

export default function* authSaga() {
  yield takeLatest(authActions.loginRequest.type, handleLogin);
  yield takeLatest(authActions.registerRequest.type, handleRegister);
  yield takeLatest(authActions.joinTenantRequest.type, handleJoinTenant);
  yield takeLatest(authActions.logout.type, handleLogout);
}