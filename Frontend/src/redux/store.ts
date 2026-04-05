import { configureStore } from "@reduxjs/toolkit";
import createSagaMiddleware from "redux-saga";
import authReducer from"../redux/slice/authSlice";
import authSaga from "../redux/saga/authSaga";

const sagaMiddleware = createSagaMiddleware();

export const store = configureStore({
  reducer:{
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({thunk:false}).concat(sagaMiddleware),
});
sagaMiddleware.run(authSaga);

export type RootState = ReturnType< typeof store.getState>;
export type AppDispatch = typeof store.dispatch;