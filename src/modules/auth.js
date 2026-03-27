// API 鉴权模块
export default class Auth {
  constructor(env) {
    this.env = env;
  }

  // 检查 API Key 是否已配置
  isApiKeyConfigured() {
    return !!this.env.ADMIN_API_KEY && this.env.ADMIN_API_KEY.length > 0;
  }

  // 验证管理端 API Key
  verifyAdminKey(request) {
    // 检查 API Key 是否已配置
    if (!this.isApiKeyConfigured()) {
      return { success: false, message: '服务器未配置 API Key，请联系管理员' };
    }

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
    const adminActions = [
      'createQuestion',
      'deleteQuestion',
      'clearRecords',
      'archiveQuestion',
      'importQuestionBank',
      'getQuestionBank',
      'pushFromBank',
      'clearQuestionBank'
    ];
    return adminActions.includes(action);
  }
}
