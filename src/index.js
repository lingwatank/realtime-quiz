// 答题系统主入口 - Cloudflare Workers
import QuestionUpload from './modules/questionUpload.js';
import QuestionFetch from './modules/questionFetch.js';
import AnswerSubmit from './modules/answerSubmit.js';
import AnswerRecord from './modules/answerRecord.js';
import ClientJoin from './modules/clientJoin.js';
import AdminData from './modules/adminData.js';
import Auth from './modules/auth.js';
import QuestionBank from './modules/questionBank.js';

// 简单的速率限制器（基于 IP）
const rateLimiter = {
  attempts: new Map(),
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 分钟
  
  isAllowed(ip) {
    const now = Date.now();
    const record = this.attempts.get(ip);
    
    if (!record) {
      this.attempts.set(ip, { count: 1, firstAttempt: now });
      return true;
    }
    
    // 清理过期记录
    if (now - record.firstAttempt > this.windowMs) {
      this.attempts.set(ip, { count: 1, firstAttempt: now });
      return true;
    }
    
    if (record.count >= this.maxAttempts) {
      return false;
    }
    
    record.count++;
    return true;
  },
  
  reset(ip) {
    this.attempts.delete(ip);
  }
};

// CORS 响应头 - 生产环境应限制为特定域名
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // TODO: 生产环境改为特定域名，如 'https://yourdomain.com'
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json'
};

// 安全响应头
const securityHeaders = {
  'X-Frame-Options': 'DENY',                    // 防止点击劫持
  'X-Content-Type-Options': 'nosniff',          // 防止 MIME 嗅探
  'X-XSS-Protection': '1; mode=block',          // XSS 防护（浏览器支持）
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
};

// HTML 响应头
const htmlHeaders = {
  'Content-Type': 'text/html; charset=utf-8',
  ...securityHeaders
};

// 处理 CORS 预检请求
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

// 创建 JSON 响应
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: {
      ...corsHeaders,
      ...securityHeaders
    }
  });
}

// 创建 HTML 响应
function htmlResponse(html, status = 200) {
  return new Response(html, {
    status: status,
    headers: htmlHeaders
  });
}

// 主请求处理函数
export default {
  async fetch(request, env, ctx) {
    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 登录页面
    if (path === '/login' || path === '/login.html') {
      return env.ASSETS.fetch(new URL('/login.html', request.url));
    }

    // 静态资源路由 - 从 public 目录提供
    if (path === '/' || path === '/client' || path === '/client.html') {
      return env.ASSETS.fetch(new URL('/client.html', request.url));
    }

    // 管理端路由 - 使用有意义但不易猜测的路径
    if (path === '/ctrl-panel' || path === '/ctrl-panel.html') {
      return env.ASSETS.fetch(new URL('/admin.html', request.url));
    }

    if (path === '/data-mgmt' || path === '/data-mgmt.html') {
      return env.ASSETS.fetch(new URL('/admin-data.html', request.url));
    }

    if (path === '/stats-view' || path === '/stats-view.html') {
      return env.ASSETS.fetch(new URL('/admin-stats.html', request.url));
    }

    // 初始化模块（每次请求都创建新实例，但数据从 KV 加载）
    const questionUpload = new QuestionUpload(env);
    const answerRecord = new AnswerRecord(env);
    const clientJoin = new ClientJoin(env);
    const questionFetch = new QuestionFetch(questionUpload);
    const answerSubmit = new AnswerSubmit(questionUpload, answerRecord);
    const adminData = new AdminData(questionUpload, answerRecord, clientJoin);
    const auth = new Auth(env);
    const questionBank = new QuestionBank(env);

    try {
      // ==================== 核心 API（精简版）====================

      // 【聚合API】获取所有数据（题目、答题记录、统计）- 需要鉴权
      if (path === '/api/data' && method === 'GET') {
        // 验证管理员权限
        const authResult = auth.verifyAdminKey(request);
        if (!authResult.success) {
          return jsonResponse(authResult, 401);
        }

        const typeParam = url.searchParams.get('type') || 'all';
        const types = typeParam.split(',').map(t => t.trim());
        const isAll = types.includes('all');
        const questionId = url.searchParams.get('questionId');

        let result = { success: true, data: {} };

        // 获取题目数据
        if (isAll || types.includes('questions')) {
          if (questionId) {
            // 获取单个题目详情
            const question = await questionFetch.getQuestionById(parseInt(questionId));
            if (question) {
              const records = await answerRecord.getRecordsByQuestionId(parseInt(questionId));
              result.data.question = {
                ...question,
                expired: questionUpload.isQuestionExpired(question),
                totalSubmissions: records.length,
                correctCount: records.filter(r => r.isCorrect).length,
                records: records
              };
            }
          } else {
            // 获取题目列表
            const questions = await questionFetch.getQuestionList(100);
            const questionStats = await answerRecord.getQuestionStatistics();
            result.data.questions = questions.map(q => {
              const stats = questionStats[q.id] || { totalSubmissions: 0, correctCount: 0, correctRate: '0.0%' };
              return {
                ...q,
                ...stats,
                expired: questionUpload.isQuestionExpired(q)
              };
            });
          }
        }

        // 获取答题记录
        if (isAll || types.includes('answers')) {
          result.data.answers = await answerRecord.getAllRecords();
        }

        // 获取统计数据
        if (isAll || types.includes('stats')) {
          const [dashboard, participants] = await Promise.all([
            adminData.getDashboardData(),
            answerRecord.getParticipantStatistics()
          ]);
          result.data.stats = dashboard;
          result.data.participants = participants;
        }

        // 获取历史题目
        if (isAll || types.includes('history')) {
          const history = await questionUpload.getQuestionHistory();
          const questionStats = await answerRecord.getQuestionStatistics();
          result.data.questionHistory = history.map(q => {
            const stats = questionStats[q.id] || { totalSubmissions: 0, correctCount: 0, correctRate: '0.0%' };
            return {
              ...q,
              ...stats,
              expired: true
            };
          });
        }

        return jsonResponse(result);
      }

      // 【轻量API】管理端首页专用（只返回必要数据）- 需要鉴权
      if (path === '/api/admin/summary' && method === 'GET') {
        // 验证管理员权限
        const authResult = auth.verifyAdminKey(request);
        if (!authResult.success) {
          return jsonResponse(authResult, 401);
        }

        const questions = await questionFetch.getQuestionList(100);
        const questionStats = await answerRecord.getQuestionStatistics();
        const stats = await answerRecord.getStatistics();
        
        // 只返回必要的数据
        const summary = {
          stats: {
            totalQuestions: questions.length,
            totalSubmissions: stats.totalSubmissions,
            correctRate: stats.correctRate,
            totalParticipants: (await answerRecord.getParticipantStatistics()).length
          },
          questions: questions.map(q => {
            const stats = questionStats[q.id] || { totalSubmissions: 0, correctCount: 0, correctRate: '0.0%' };
            return {
              id: q.id,
              text: q.text,
              options: q.options,
              correctAnswer: q.correctAnswer,
              createdAt: q.createdAt,
              expiresAt: q.expiresAt,
              expired: questionUpload.isQuestionExpired(q),
              totalSubmissions: stats.totalSubmissions,
              correctCount: stats.correctCount,
              correctRate: stats.correctRate
            };
          })
        };
        
        return jsonResponse({ success: true, data: summary });
      }

      // 【聚合API】提交操作（题目管理 + 答题 + 删除）
      if (path === '/api/action' && method === 'POST') {
        const body = await request.json();
        const action = body.action;

        // 管理操作需要鉴权
        if (auth.isAdminAction(action)) {
          const authResult = auth.verifyAdminKey(request);
          if (!authResult.success) {
            return jsonResponse(authResult, 401);
          }
        }

        switch (action) {
          case 'submitAnswer':
            return jsonResponse(await answerSubmit.submitAnswer(
              body.questionId,
              body.answer,
              body.userId,
              body.nickname
            ));

          case 'createQuestion':
            return jsonResponse(await questionUpload.uploadQuestion(body.data, body.force === true));

          case 'deleteQuestion':
            if (body.id) {
              return jsonResponse(await questionUpload.deleteQuestion(body.id));
            } else {
              return jsonResponse(await questionUpload.deleteAllQuestions());
            }

          case 'archiveQuestion':
            return jsonResponse(await questionUpload.archiveCurrentQuestion());

          case 'clearRecords':
            return jsonResponse(await answerRecord.clearAllRecords());

          case 'clientJoin':
            return jsonResponse(await clientJoin.joinClient());

          case 'clientLeave':
            return jsonResponse(await clientJoin.leaveClient(body.clientId));

          case 'importQuestionBank':
            return jsonResponse(await questionBank.importBank(body.questions));

          case 'getQuestionBank':
            return jsonResponse({ success: true, data: await questionBank.getBank() });

          case 'pushFromBank':
            return jsonResponse(await questionBank.pushToCurrent(body.questionId, questionUpload));

          case 'clearQuestionBank':
            return jsonResponse(await questionBank.clearBank());

          default:
            return jsonResponse({ success: false, message: '未知操作' }, 400);
        }
      }

      // 【聚合API】获取最新题目（含用户答题状态）
      if (path === '/api/latest' && method === 'POST') {
        const body = await request.json();
        const userId = body.userId;
        
        const question = await questionFetch.getLatestQuestion();
        
        if (!question) {
          return jsonResponse({ success: true, data: { question: null, answerStatus: null } });
        }
        
        // 获取用户答题状态
        const hasAnswered = await answerRecord.hasUserAnsweredQuestion(userId, question.id);
        let answerStatus = { hasAnswered: false };
        
        if (hasAnswered) {
          const previousAnswer = await answerRecord.getUserAnswerForQuestion(userId, question.id);
          if (previousAnswer) {
            answerStatus = {
              hasAnswered: true,
              answer: previousAnswer.userAnswer,
              isCorrect: previousAnswer.isCorrect,
              submittedAt: previousAnswer.submittedAt
            };
          }
        }
        
        return jsonResponse({ 
          success: true, 
          data: { 
            question: question, 
            answerStatus: answerStatus 
          } 
        });
      }

      // 【聚合API】导出数据 - 需要鉴权
      if (path === '/api/export' && method === 'GET') {
        // 验证管理员权限
        const authResult = auth.verifyAdminKey(request);
        if (!authResult.success) {
          return jsonResponse(authResult, 401);
        }

        const type = url.searchParams.get('type') || 'all';

        let exportData = {
          exportTime: new Date().toISOString(),
          type: type
        };

        if (type === 'questions' || type === 'all') {
          exportData.questions = await questionUpload.getAllQuestions();
        }

        if (type === 'answers' || type === 'all') {
          exportData.answers = await answerRecord.getAllRecords();
        }

        if (type === 'all') {
          const participants = await answerRecord.getParticipantStatistics();
          exportData.participants = participants;
          exportData.summary = {
            totalQuestions: exportData.questions.length,
            totalAnswers: exportData.answers.length,
            totalParticipants: participants.length
          };
        }

        return jsonResponse({ success: true, data: exportData });
      }

      // 【登录API】验证 API Key（带速率限制）
      if (path === '/api/login' && method === 'POST') {
        // 检查 API Key 是否已配置
        if (!env.ADMIN_API_KEY) {
          return jsonResponse({ success: false, message: '服务器未配置 API Key，请联系管理员' }, 500);
        }
        
        // 获取客户端 IP
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        
        // 检查速率限制
        if (!rateLimiter.isAllowed(clientIP)) {
          return jsonResponse({ success: false, message: '登录尝试次数过多，请15分钟后再试' }, 429);
        }
        
        const body = await request.json();
        const apiKey = body.apiKey;

        if (!apiKey) {
          return jsonResponse({ success: false, message: '请提供 API Key' }, 400);
        }

        if (apiKey !== env.ADMIN_API_KEY) {
          return jsonResponse({ success: false, message: '无效的 API Key' }, 401);
        }
        
        // 登录成功，重置速率限制
        rateLimiter.reset(clientIP);

        return jsonResponse({ success: true, message: '登录成功' });
      }

      // 【健康检查】检查系统配置状态
      if (path === '/check-health' && method === 'GET') {
        const health = {
          success: true,
          timestamp: new Date().toISOString(),
          status: 'healthy',
          checks: {
            apiKey: {
              configured: !!env.ADMIN_API_KEY && env.ADMIN_API_KEY.length > 0,
              message: env.ADMIN_API_KEY ? '已配置' : '未配置 - 请运行 wrangler secret put ADMIN_API_KEY'
            },
            kvStorage: {
              connected: !!env.EXAM_KV,
              message: env.EXAM_KV ? '已连接' : '未连接 - 请检查 KV 绑定配置'
            },
            assets: {
              configured: !!env.ASSETS,
              message: env.ASSETS ? '已配置' : '未配置 - 请检查静态资源绑定'
            }
          }
        };

        // 如果有任何检查失败，标记为不健康
        const hasIssues = Object.values(health.checks).some(check => {
          // 检查 configured 或 connected 字段
          return check.configured === false || check.connected === false;
        });
        if (hasIssues) {
          health.status = 'unhealthy';
        }

        return jsonResponse(health, hasIssues ? 503 : 200);
      }

      // 404 响应
      return jsonResponse({ success: false, message: 'Not Found' }, 404);

    } catch (error) {
      console.error('API Error:', error);
      return jsonResponse({ success: false, message: error.message }, 500);
    }
  }
};
