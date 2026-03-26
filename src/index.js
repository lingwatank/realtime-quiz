// 答题系统主入口 - Cloudflare Workers
import QuestionUpload from './modules/questionUpload.js';
import QuestionFetch from './modules/questionFetch.js';
import AnswerSubmit from './modules/answerSubmit.js';
import AnswerRecord from './modules/answerRecord.js';
import ClientJoin from './modules/clientJoin.js';
import AdminData from './modules/adminData.js';

// CORS 响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// HTML 响应头
const htmlHeaders = {
  'Content-Type': 'text/html; charset=utf-8'
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
    headers: corsHeaders
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

    // 静态资源路由 - 从 public 目录提供
    if (path === '/' || path === '/client' || path === '/client.html') {
      return env.ASSETS.fetch(new URL('/client.html', request.url));
    }

    if (path === '/admin' || path === '/admin.html') {
      return env.ASSETS.fetch(new URL('/admin.html', request.url));
    }

    if (path === '/admin-data' || path === '/admin-data.html') {
      return env.ASSETS.fetch(new URL('/admin-data.html', request.url));
    }

    if (path === '/admin-stats' || path === '/admin-stats.html') {
      return env.ASSETS.fetch(new URL('/admin-stats.html', request.url));
    }

    // 初始化模块（每次请求都创建新实例，但数据从 KV 加载）
    const questionUpload = new QuestionUpload(env);
    const answerRecord = new AnswerRecord(env);
    const clientJoin = new ClientJoin(env);
    const questionFetch = new QuestionFetch(questionUpload);
    const answerSubmit = new AnswerSubmit(questionUpload, answerRecord);
    const adminData = new AdminData(questionUpload, answerRecord, clientJoin);

    try {
      // ==================== 核心 API（精简版）====================

      // 【聚合API】获取所有数据（题目、答题记录、统计）
      if (path === '/api/data' && method === 'GET') {
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

      // 【轻量API】管理端首页专用（只返回必要数据）
      if (path === '/api/admin/summary' && method === 'GET') {
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

          case 'clearRecords':
            return jsonResponse(await answerRecord.clearAllRecords());
            
          case 'clientJoin':
            return jsonResponse(await clientJoin.joinClient());
            
          case 'clientLeave':
            return jsonResponse(await clientJoin.leaveClient(body.clientId));
            
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

      // 【聚合API】导出数据
      if (path === '/api/export' && method === 'GET') {
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

      // 404 响应
      return jsonResponse({ success: false, message: 'Not Found' }, 404);

    } catch (error) {
      console.error('API Error:', error);
      return jsonResponse({ success: false, message: error.message }, 500);
    }
  }
};
