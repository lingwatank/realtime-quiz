// API 鉴权模块
export default class Auth {
  constructor(env) {
    this.env = env;
  }

  // 验证管理端 API Key
  verifyAdminKey(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { success: false, message: '缺少 Authorization 头' };
    }

    const token = authHeader.substring(7);
    if (token !== this.env.ADMIN_API_KEY) {
      return { success: false, message: '无效的 API Key' };
    }

    return { success: true };
  }

  // 检查请求是否需要鉴权
  isAdminAction(action) {
    const adminActions = ['createQuestion', 'deleteQuestion', 'clearRecords'];
    return adminActions.includes(action);
  }
}
