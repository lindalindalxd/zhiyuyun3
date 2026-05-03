/* 智育云 — 主交互脚本 */

/* ===================== DeepSeek API ===================== */
const DEEPSEEK_CONFIG = {
  apiKey: 'sk-453a54ca03b5479b9ee7c8fda18f7c64',
  endpoint: 'https://api.deepseek.com/chat/completions',
  model: 'deepseek-chat'
};

// 非流式调用
async function callDeepSeek(userMessage, systemPrompt) {
  const response = await fetch(DEEPSEEK_CONFIG.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + DEEPSEEK_CONFIG.apiKey
    },
    body: JSON.stringify({
      model: DEEPSEEK_CONFIG.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 2048,
      temperature: 0.7
    })
  });
  if (!response.ok) throw new Error('API请求失败: ' + response.status);
  const data = await response.json();
  return data.choices[0].message.content;
}

// 流式调用（用于AI问答助手）
async function callDeepSeekStream(userMessage, systemPrompt, onChunk) {
  const response = await fetch(DEEPSEEK_CONFIG.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + DEEPSEEK_CONFIG.apiKey
    },
    body: JSON.stringify({
      model: DEEPSEEK_CONFIG.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      stream: true,
      max_tokens: 2048,
      temperature: 0.7
    })
  });
  if (!response.ok) throw new Error('API请求失败: ' + response.status);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ') && !line.includes('[DONE]')) {
        try {
          const json = JSON.parse(line.slice(6));
          const content = json.choices[0].delta.content;
          if (content) {
            fullText += content;
            onChunk(content, fullText);
          }
        } catch(e) {}
      }
    }
  }
  return fullText;
}

function renderMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

/* ===================== 用户登录状态管理 ===================== */
const Auth = {
  KEY: 'zhiyuyun_user',
  getUser() {
    try { return JSON.parse(localStorage.getItem(this.KEY)); } catch { return null; }
  },
  login(username, name) {
    localStorage.setItem(this.KEY, JSON.stringify({ username, name: name || username }));
  },
  logout() {
    localStorage.removeItem(this.KEY);
    location.href = 'index.html';
  },
  isLoggedIn() { return !!this.getUser(); }
};

/* ===================== 导航栏渲染用户状态 ===================== */
function renderNavUser() {
  const loginBtn = document.querySelector('.nav-login');
  if (!loginBtn) return;
  const user = Auth.getUser();
  if (!user) return; // 未登录保持原样

  const initial = (user.name || user.username).charAt(0).toUpperCase();
  const displayName = user.name || user.username;

  const userEl = document.createElement('div');
  userEl.className = 'nav-user';
  userEl.id = 'navUserArea';
  userEl.innerHTML =
    '<div class="nav-user-avatar">' + initial + '</div>' +
    '<span class="nav-user-name">' + displayName + '</span>' +
    '<span class="nav-user-arrow">▼</span>' +
    '<div class="nav-user-dropdown">' +
      '<div class="nav-user-dropdown-header">' +
        '<div class="nav-user-dropdown-name">' + displayName + '</div>' +
        '<div class="nav-user-dropdown-role">历史教师 · 智育云用户</div>' +
      '</div>' +
      '<div class="nav-dropdown-item" onclick="location.href=\'artifacts.html\'">📚 文物库</div>' +
      '<div class="nav-dropdown-item" onclick="location.href=\'ai-tools.html\'">🤖 AI备课工具</div>' +
      '<div class="nav-dropdown-divider"></div>' +
      '<div class="nav-dropdown-item danger" id="logoutBtn">🚪 退出登录</div>' +
    '</div>';

  loginBtn.replaceWith(userEl);

  document.getElementById('logoutBtn')?.addEventListener('click', function(e) {
    e.stopPropagation();
    Auth.logout();
  });

  // 点击外部关闭下拉菜单
  document.addEventListener('click', function(e) {
    const area = document.getElementById('navUserArea');
    if (area && !area.contains(e.target)) area.classList.remove('open');
  });
  userEl.addEventListener('click', function(e) {
    e.stopPropagation();
    this.classList.toggle('open');
  });
}

/* ===================== 主逻辑入口 ===================== */
document.addEventListener('DOMContentLoaded', () => {

  /* ===== 渲染导航栏用户状态 ===== */
  renderNavUser();

  /* ===== 登录页逻辑 ===== */
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      const username = (document.getElementById('loginUsername')?.value || '').trim();
      const password = (document.getElementById('loginPassword')?.value || '').trim();
      const errEl = document.getElementById('loginError');
      if (!username || !password) {
        errEl.style.display = 'block';
        errEl.textContent = '账号和密码不能为空';
        return;
      }
      errEl.style.display = 'none';
      Auth.login(username, username);
      // 跳回来源页或首页
      const from = sessionStorage.getItem('zhiyuyun_from') || 'index.html';
      sessionStorage.removeItem('zhiyuyun_from');
      location.href = from;
    });
    ['loginUsername', 'loginPassword'].forEach(id => {
      document.getElementById(id)?.addEventListener('keydown', e => {
        if (e.key === 'Enter') loginBtn.click();
      });
    });
  }

  /* ===== 注册页逻辑 ===== */
  const regBtn = document.getElementById('regBtn');
  if (regBtn) {
    regBtn.addEventListener('click', () => {
      const username = (document.getElementById('regUsername')?.value || '').trim();
      const name     = (document.getElementById('regName')?.value || '').trim();
      const pwd      = (document.getElementById('regPassword')?.value || '');
      const pwd2     = (document.getElementById('regPassword2')?.value || '');
      const errEl    = document.getElementById('regError');
      if (!username || !name || !pwd || !pwd2) {
        errEl.style.display = 'block'; errEl.textContent = '请填写所有字段'; return;
      }
      if (username.length < 4) {
        errEl.style.display = 'block'; errEl.textContent = '账号至少4位'; return;
      }
      if (pwd.length < 6) {
        errEl.style.display = 'block'; errEl.textContent = '密码至少6位'; return;
      }
      if (pwd !== pwd2) {
        errEl.style.display = 'block'; errEl.textContent = '两次密码不一致，请重新输入'; return;
      }
      errEl.style.display = 'none';
      Auth.login(username, name);
      location.href = 'index.html';
    });
    ['regUsername','regName','regPassword','regPassword2'].forEach(id => {
      document.getElementById(id)?.addEventListener('keydown', e => {
        if (e.key === 'Enter') regBtn.click();
      });
    });
  }

  /* ===== 已登录则直接跳过登录页 ===== */
  if (document.querySelector('.auth-page') && Auth.isLoggedIn()) {
    location.href = 'index.html';
  }

  /* ===== 导航栏滚动变色 ===== */
  const navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 50);
    });
  }

  /* ===== 搜索弹窗 ===== */
  const searchModal = document.getElementById('searchModal');
  document.querySelectorAll('[data-search-open]').forEach(btn => {
    btn.addEventListener('click', () => searchModal && searchModal.classList.add('open'));
  });
  const closeSearchBtn = document.getElementById('closeSearch');
  if (closeSearchBtn) closeSearchBtn.addEventListener('click', () => searchModal.classList.remove('open'));
  if (searchModal) {
    searchModal.addEventListener('click', e => {
      if (e.target === searchModal) searchModal.classList.remove('open');
    });
  }
  document.querySelectorAll('.hot-search-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const input = document.querySelector('.search-modal-input');
      if (input) { input.value = tag.textContent; input.focus(); }
    });
  });

  /* ===== 文物卡片过滤（首页）===== */
  const filterBtns = document.querySelectorAll('.filter-btn');
  const artifactCards = document.querySelectorAll('[data-era]');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      artifactCards.forEach(card => {
        if (filter === 'all' || card.dataset.era === filter) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  /* ===== 文物库页面 - 实时搜索 ===== */
  const searchInput = document.getElementById('artifactSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase();
      document.querySelectorAll('.artifact-card').forEach(card => {
        const name = card.querySelector('.artifact-card-name')?.textContent.toLowerCase() || '';
        const desc = card.querySelector('.artifact-card-desc')?.textContent.toLowerCase() || '';
        card.style.display = (name.includes(q) || desc.includes(q) || q === '') ? '' : 'none';
      });
    });
  }

  /* ===== 登录/注册 Tab切换 ===== */
  const authTabs = document.querySelectorAll('.auth-tab');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      authTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const type = tab.dataset.tab;
      if (loginForm) loginForm.style.display = type === 'login' ? '' : 'none';
      if (registerForm) registerForm.style.display = type === 'register' ? '' : 'none';
    });
  });

  /* ===== 画廊缩略图切换 ===== */
  document.querySelectorAll('.gallery-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    });
  });

  /* ===== 卡片入场动画 ===== */
  const styleEl = document.createElement('style');
  styleEl.textContent =
    '@keyframes fadeInUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}' +
    '.animate-in{animation:fadeInUp 0.5s ease both}';
  document.head.appendChild(styleEl);

  const animObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('animate-in'), i * 70);
        animObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.feature-card, .artifact-card, .ai-tool-card, .ai-large-card').forEach(el => {
    el.style.opacity = '0';
    animObserver.observe(el);
  });

  /* ===== AI工具 - 教学设计生成器 ===== */
  const genDesignBtn = document.getElementById('genDesignBtn');
  const designInput = document.getElementById('designInput');
  const designResult = document.getElementById('designResult');
  if (genDesignBtn && designInput && designResult) {
    genDesignBtn.addEventListener('click', async function() {
      const input = designInput.value.trim();
      if (!input) { alert('请输入文物名称和教学需求'); return; }
      const orig = this.textContent;
      this.textContent = '生成中...';
      this.disabled = true;
      designResult.querySelector('.ai-result-content').innerHTML = '<div class="ai-loading"><span></span><span></span><span></span></div>';
      try {
        const content = await callDeepSeek(input, '你是一位资深的中学历史教学设计专家。请根据用户输入的文物名称和教学需求，生成完整的一课时教学设计，包含：1.教学目标（知识、能力、情感三个维度）2.教学重难点 3.课堂活动方案（导入、新授、巩固、小结四个环节）4.板书设计建议。请确保内容符合初中历史课程标准，便于教师直接使用。');
        designResult.querySelector('.ai-result-content').innerHTML = renderMarkdown(content);
      } catch (err) {
        designResult.querySelector('.ai-result-content').innerHTML = '<span style="color:#c0392b;">生成失败：' + err.message + '</span>';
      } finally {
        this.textContent = orig;
        this.disabled = false;
      }
    });
  }

  /* ===== AI工具 - 课件大纲助手 ===== */
  const genOutlineBtn = document.getElementById('genOutlineBtn');
  const outlineInput = document.getElementById('outlineInput');
  const outlineResult = document.getElementById('outlineResult');
  if (genOutlineBtn && outlineInput && outlineResult) {
    genOutlineBtn.addEventListener('click', async function() {
      const input = outlineInput.value.trim();
      if (!input) { alert('请输入教材内容和文物信息'); return; }
      const orig = this.textContent;
      this.textContent = '生成中...';
      this.disabled = true;
      outlineResult.querySelector('.ai-result-content').innerHTML = '<div class="ai-loading"><span></span><span></span><span></span></div>';
      try {
        const content = await callDeepSeek(input, '你是PPT课件设计专家。根据用户提供的教材内容和文物信息，生成结构化的PPT大纲。格式为逐页说明：第1页-标题、第2页-导入等。每页包含：标题、核心要点（2-3条）、建议配图说明。适合中学历史课堂使用。');
        outlineResult.querySelector('.ai-result-content').innerHTML = renderMarkdown(content);
      } catch (err) {
        outlineResult.querySelector('.ai-result-content').innerHTML = '<span style="color:#c0392b;">生成失败：' + err.message + '</span>';
      } finally {
        this.textContent = orig;
        this.disabled = false;
      }
    });
  }

  /* ===== AI工具 - 历史习题生成器 ===== */
  const genQuestionsBtn = document.getElementById('genQuestionsBtn');
  const questionType = document.getElementById('questionType');
  const difficultyLevel = document.getElementById('difficultyLevel');
  const knowledgeInput = document.getElementById('knowledgeInput');
  const questionsResult = document.getElementById('questionsResult');
  if (genQuestionsBtn && questionType && difficultyLevel && knowledgeInput && questionsResult) {
    genQuestionsBtn.addEventListener('click', async function() {
      const knowledge = knowledgeInput.value.trim();
      if (!knowledge) { alert('请输入知识点'); return; }
      const type = questionType.value;
      const difficulty = difficultyLevel.value;
      const prompt = '题目类型：' + type + '，难度：' + difficulty + '，知识点：' + knowledge;
      const orig = this.textContent;
      this.textContent = '生成中...';
      this.disabled = true;
      questionsResult.querySelector('.ai-result-content').innerHTML = '<div class="ai-loading"><span></span><span></span><span></span></div>';
      try {
        const content = await callDeepSeek(prompt, '你是中考历史命题专家。根据用户提供的知识点、题型和难度要求生成习题。选择题需4个选项和答案解析。材料分析题需提供材料原文、设问和参考答案。每道题附详细解析。');
        questionsResult.querySelector('.ai-result-content').innerHTML = renderMarkdown(content);
      } catch (err) {
        questionsResult.querySelector('.ai-result-content').innerHTML = '<span style="color:#c0392b;">生成失败：' + err.message + '</span>';
      } finally {
        this.textContent = orig;
        this.disabled = false;
      }
    });
  }

  /* ===== AI工具 - AI问答助手 ===== */
  const sendChatBtn = document.getElementById('sendChatBtn');
  const chatInput = document.getElementById('chatInput');
  const chatHistory = document.getElementById('chatHistory');
  if (sendChatBtn && chatInput && chatHistory) {
    const chatSystemPrompt = '你是中学历史教学助手「智育云AI」。请对用户的历史问题进行专业、准确的解答。回答要简洁清晰，适合中学师生理解，可引用具体文物实例辅助说明。';

    async function sendChatMessage() {
      const input = chatInput.value.trim();
      if (!input) return;
      if (sendChatBtn.disabled) return;
      chatInput.value = '';
      sendChatBtn.disabled = true;
      sendChatBtn.textContent = '生成中...';

      // 添加用户消息
      const userMsgDiv = document.createElement('div');
      userMsgDiv.className = 'chat-message chat-message-user';
      userMsgDiv.innerHTML = '<div class="chat-avatar chat-avatar-user">师</div><div class="chat-bubble chat-bubble-user">' + input.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
      chatHistory.appendChild(userMsgDiv);
      chatHistory.scrollTop = chatHistory.scrollHeight;

      // 添加AI消息占位
      const aiMsgDiv = document.createElement('div');
      aiMsgDiv.className = 'chat-message chat-message-ai';
      aiMsgDiv.innerHTML = '<div class="chat-avatar chat-avatar-ai">AI</div><div class="chat-bubble chat-bubble-ai"><div class="ai-loading"><span></span><span></span><span></span></div></div>';
      chatHistory.appendChild(aiMsgDiv);
      chatHistory.scrollTop = chatHistory.scrollHeight;

      const aiBubble = aiMsgDiv.querySelector('.chat-bubble-ai');

      try {
        let fullText = '';
        await callDeepSeekStream(input, chatSystemPrompt, (chunk, full) => {
          fullText = full;
          aiBubble.innerHTML = renderMarkdown(fullText);
          chatHistory.scrollTop = chatHistory.scrollHeight;
        });
      } catch (err) {
        aiBubble.innerHTML = '<span style="color:#c0392b;">回复失败：' + err.message + '</span>';
      } finally {
        sendChatBtn.disabled = false;
        sendChatBtn.textContent = '发送';
      }
    }

    sendChatBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') sendChatMessage();
    });
  }

  /* ===== 下载按钮反馈 ===== */
  document.querySelectorAll('.btn-download').forEach(btn => {
    btn.addEventListener('click', function() {
      const orig = this.textContent;
      this.textContent = '准备中...';
      setTimeout(() => {
        this.textContent = '✓ 下载成功';
        setTimeout(() => { this.textContent = orig; }, 2000);
      }, 800);
    });
  });

  /* ===== 页脚年份 ===== */
  const yearEl = document.getElementById('currentYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  console.log('智育云 — 页面加载完成 ✓ 登录状态:', Auth.isLoggedIn() ? Auth.getUser().name : '未登录');
});
