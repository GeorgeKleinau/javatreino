const state = { exercises: [], activeExercise: 0, activeFile: 0, drafts: JSON.parse(localStorage.getItem('codetype-drafts') || '{}') };
const $ = selector => document.querySelector(selector);
const editor = $('#codeEditor');
const highlightLayer = $('#highlightLayer');
const saved = () => localStorage.setItem('codetype-drafts', JSON.stringify(state.drafts));
const exercise = () => state.exercises[state.activeExercise];
const file = () => exercise().files[state.activeFile];
const draftKey = () => `${exercise().id}/${file().path}`;

function escapeHTML(text) { return text.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]); }
function displayTitle(item) {
  const labels = {
    Cantina: 'Cantina',
    Biblioteca: 'Biblioteca',
    ClubeCorrida: 'Clube de Corrida',
    Restaurante: 'Restaurante',
    Eleicao: 'Eleição',
    PetShop: 'Pet Shop'
  };
  return labels[item.title] || item.title.replaceAll('_', ' ');
}

function updateLineNumbers() {
  const typed = editor.value.split('\n');
  const typedCode = state.exercises.length ? codeLines(editor.value) : [];
  const expectedCode = state.exercises.length ? codeLines(file().code) : [];
  const statusByLine = new Map(typedCode.map((item, index) => [item.line, item.text === expectedCode[index]?.text ? ' correct' : ' incorrect']));
  $('#lineNumbers').innerHTML = Array.from({ length: Math.max(1, typed.length) }, (_, index) => {
    const status = !editor.value ? '' : statusByLine.get(index + 1) || '';
    return `<span class="line-number${status}">${index + 1}</span>`;
  }).join('\n');
  $('#lineNumbers').scrollTop = editor.scrollTop;
}
function highlightJava(source) {
  const tokenPattern = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|\b(package|import|public|private|protected|class|interface|enum|static|final|void|return|new|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|throws|extends|implements|this|super|true|false|null)\b|\b(String|Integer|Double|Boolean|Character|Object|ArrayList|List|Scanner|System|Math|[A-Z][A-Za-z0-9_]*)\b|\b\d+(?:\.\d+)?\b/g;
  let output = '';
  let cursor = 0;
  for (const match of source.matchAll(tokenPattern)) {
    output += escapeHTML(source.slice(cursor, match.index));
    const token = escapeHTML(match[0]);
    const className = match[1] ? 'token-comment' : match[2] || match[3] ? 'token-string' : match[4] ? 'token-keyword' : match[5] ? 'token-type' : 'token-number';
    output += `<span class="${className}">${token}</span>`;
    cursor = match.index + match[0].length;
  }
  return output + escapeHTML(source.slice(cursor)) + '\n';
}
function updateHighlight() {
  highlightLayer.innerHTML = highlightJava(editor.value);
  highlightLayer.style.transform = `translate(${-editor.scrollLeft}px, ${-editor.scrollTop}px)`;
}
function updateProgress() {
  const all = state.exercises.flatMap(item => item.files);
  const complete = all.filter(item => normalize(state.drafts[`${state.exercises.find(ex => ex.files.includes(item)).id}/${item.path}`] || '') === normalize(item.code)).length;
  $('#overallProgress').textContent = `${complete} de ${all.length} arquivos concluídos`;
  $('#progressBar').style.width = `${all.length ? complete / all.length * 100 : 0}%`;
}
function renderExercises() {
  $('#exerciseList').innerHTML = state.exercises.map((item, index) => {
    const complete = item.files.every(source => normalize(state.drafts[`${item.id}/${source.path}`] || '') === normalize(source.code));
    return `<button class="exercise-button ${index === state.activeExercise ? 'active' : ''}" data-exercise="${index}"><span class="exercise-number">${String(index + 1).padStart(2, '0')}</span><span>${escapeHTML(displayTitle(item))}</span>${complete ? '<span class="done-badge">✓</span>' : ''}</button>`;
  }).join('');
}
function renderFiles() {
  $('#exerciseLabel').textContent = `ATIVIDADE ${String(state.activeExercise + 1).padStart(2, '0')}`;
  $('#exerciseTitle').textContent = displayTitle(exercise());
  $('#fileTabs').innerHTML = exercise().files.map((item, index) => `<button class="file-tab ${index === state.activeFile ? 'active' : ''}" data-file="${index}" role="tab">${escapeHTML(item.name)}</button>`).join('');
  $('#filePath').textContent = file().path;
  editor.value = state.drafts[draftKey()] || '';
  updateLineNumbers();
  updateHighlight();
}
function normalize(text) { return text.replace(/\r\n/g, '\n').replace(/\n$/, ''); }
function codeLines(text) {
  let inBlockComment = false;
  return normalize(text).split('\n').flatMap((line, index) => {
    const trimmed = line.trim();
    const startsBlock = line.includes('/*');
    const endsBlock = line.includes('*/');
    const isComment = inBlockComment || startsBlock || endsBlock || line.includes('//');
    if (startsBlock) inBlockComment = !endsBlock;
    else if (endsBlock) inBlockComment = false;
    return !trimmed || isComment ? [] : [{ text: line, line: index + 1 }];
  });
}
function firstDifference(expected, typed) {
  const limit = Math.min(expected.length, typed.length);
  for (let index = 0; index < limit; index++) if (expected[index] !== typed[index]) return index + 1;
  return limit + 1;
}
function analyze(expected, actual) {
  const wanted = codeLines(expected);
  const typed = codeLines(actual);
  const issues = [];
  const max = Math.max(wanted.length, typed.length);
  for (let index = 0; index < max; index++) {
    const expectedLine = wanted[index];
    const typedLine = typed[index];
    if (expectedLine?.text === typedLine?.text) continue;
    let reason;
    if (!typedLine) reason = 'Linha de código faltando.';
    else if (!expectedLine) reason = 'Linha de código extra.';
    else if (expectedLine.text.toLocaleLowerCase('pt-BR') === typedLine.text.toLocaleLowerCase('pt-BR')) reason = 'Maiúsculas/minúsculas diferentes (a comparação é case sensitive).';
    else if (expectedLine.text.trim() === typedLine.text.trim()) reason = 'Indentação ou espaços diferentes.';
    else if (expectedLine.text.replace(/\s/g, '') === typedLine.text.replace(/\s/g, '')) reason = 'Espaços em posição diferente.';
    else reason = `Texto diferente a partir do caractere ${firstDifference(expectedLine.text, typedLine.text)}.`;
    issues.push({ line: typedLine?.line || expectedLine.line, expectedLine: expectedLine?.line, reason, expected: expectedLine?.text, typed: typedLine?.text });
  }
  return { total: wanted.length, issues };
}
function validateJavaSyntax(source) {
  const issues = [];
  const stack = [];
  let inBlockComment = false;
  let quote = null;
  let quoteLine = null;
  for (const [index, originalLine] of normalize(source).split('\n').entries()) {
    const lineNumber = index + 1;
    let line = originalLine;
    if (inBlockComment) {
      const end = line.indexOf('*/');
      if (end === -1) continue;
      line = line.slice(end + 2); inBlockComment = false;
    }
    const blockStart = line.indexOf('/*');
    if (blockStart !== -1) { const blockEnd = line.indexOf('*/', blockStart + 2); if (blockEnd === -1) { inBlockComment = true; line = line.slice(0, blockStart); } else line = line.slice(0, blockStart) + line.slice(blockEnd + 2); }
    line = line.split('//')[0];
    for (let charIndex = 0; charIndex < line.length; charIndex++) {
      const char = line[charIndex];
      const escaped = charIndex > 0 && line[charIndex - 1] === '\\' && line[charIndex - 2] !== '\\';
      if (quote) { if (char === quote && !escaped) quote = null; continue; }
      if (char === '"' || char === "'") { quote = char; quoteLine = lineNumber; continue; }
      if ('{[('.includes(char)) stack.push({ char, line: lineNumber });
      if ('}])'.includes(char)) {
        const opener = stack.pop();
        const pair = { '}': '{', ']': '[', ')': '(' }[char];
        if (!opener || opener.char !== pair) issues.push({ line: lineNumber, reason: `Símbolo '${char}' sem abertura correspondente.` });
      }
    }
  }
  if (quote) issues.push({ line: quoteLine, reason: `Literal ${quote === '"' ? 'de texto' : 'de caractere'} sem fechamento.` });
  for (const opener of stack.reverse()) issues.push({ line: opener.line, reason: `Símbolo '${opener.char}' sem fechamento correspondente.` });
  if (inBlockComment) issues.push({ line: normalize(source).split('\n').length, reason: 'Comentário de bloco sem fechamento */.' });
  return issues;
}
function showResult(result, scope = 'arquivo') {
  const feedback = $('#feedback');
  const heading = $('#feedbackHeading');
  const syntaxIssues = result.syntaxIssues || [];
  if (!result.issues.length && !syntaxIssues.length) {
    heading.textContent = scope === 'atividade' ? 'Atividade concluída!' : 'Arquivo correto!';
    feedback.className = 'feedback';
    feedback.innerHTML = `<div class="all-success"><div class="empty-icon">✓</div><strong>${scope === 'atividade' ? 'Excelente! Todos os arquivos foram digitados corretamente.' : `As ${result.total} linhas estão idênticas ao gabarito.`}</strong><p>Você pode seguir para o próximo arquivo ou atividade.</p></div>`;
    return;
  }
  const totalIssues = result.issues.length + syntaxIssues.length;
  heading.textContent = `${totalIssues} ajuste${totalIssues > 1 ? 's' : ''} encontrado${totalIssues > 1 ? 's' : ''}`;
  const visible = result.issues.slice(0, 8);
  feedback.className = 'feedback';
  feedback.innerHTML = `<div class="result-summary warning">Comentários e linhas vazias não entram na comparação. A validação também verifica a estrutura básica da sintaxe Java.</div>${syntaxIssues.length ? `<div class="syntax-list">${syntaxIssues.map(issue => `<div class="issue syntax"><strong>Sintaxe — linha ${issue.line}</strong> — ${issue.reason}</div>`).join('')}</div>` : ''}<div class="issue-list">${visible.map(issue => `<div class="issue ${issue.expected === undefined ? 'correct-line' : ''}"><strong>Linha ${issue.line}${issue.expectedLine ? ` (código esperado na linha ${issue.expectedLine})` : ''}</strong> — ${issue.reason}${issue.expected !== undefined ? `<code>Esperado: ${escapeHTML(issue.expected || '(linha em branco)')}</code>` : ''}${issue.typed !== undefined ? `<code>Digitado: ${escapeHTML(issue.typed || '(linha em branco)')}</code>` : ''}</div>`).join('')}</div>${result.issues.length > visible.length ? `<p class="more">E mais ${result.issues.length - visible.length} linha(s) de código para revisar.</p>` : ''}`;
}
function verifyFile() {
  state.drafts[draftKey()] = editor.value; saved();
  const result = analyze(file().code, editor.value);
  result.syntaxIssues = validateJavaSyntax(editor.value);
  showResult(result); renderExercises(); updateProgress();
}
function submitActivity() {
  state.drafts[draftKey()] = editor.value; saved();
  const results = exercise().files.map(source => {
    const typed = state.drafts[`${exercise().id}/${source.path}`] || '';
    return { source: source.name, comparison: analyze(source.code, typed), syntaxIssues: validateJavaSyntax(typed) };
  });
  const mistakes = results.flatMap(result => result.comparison.issues.map(issue => ({ ...issue, source: result.source })));
  const syntaxIssues = results.flatMap(result => result.syntaxIssues.map(issue => ({ ...issue, source: result.source })));
  const totalIssues = mistakes.length + syntaxIssues.length;
  if (!totalIssues) showResult({ total: exercise().files.reduce((sum, source) => sum + codeLines(source.code).length, 0), issues: [], syntaxIssues: [] }, 'atividade');
  else { showResult({ total: 0, issues: mistakes, syntaxIssues }, 'atividade'); $('#feedbackHeading').textContent = `${mistakes.length + syntaxIssues.length} ajuste(s) na atividade`; }
  renderExercises(); updateProgress();
  $('#submissionTitle').textContent = totalIssues ? 'Validação concluída' : 'Atividade validada!';
  $('#submissionMessage').textContent = totalIssues ? `A atividade foi validada. Encontramos ${totalIssues} ajuste(s) para você revisar com calma.` : 'Parabéns! Sua atividade foi validada e está tudo certo.';
  $('#submissionModal').hidden = false;
}
function updateTypingFeedback() {
  const card = document.querySelector('.editor-card');
  const status = $('#typingStatus');
  const typed = editor.value;
  card.classList.remove('typing-correct', 'typing-progress', 'typing-error');
  if (!typed) { status.textContent = 'Aguardando digitação'; return; }
  const result = analyze(file().code, typed);
  const typedCode = codeLines(typed);
  const expectedCode = codeLines(file().code);
  const exactLines = typedCode.filter((line, index) => line.text === expectedCode[index]?.text).length;
  if (!result.issues.length) { card.classList.add('typing-correct'); status.textContent = 'Código idêntico ao gabarito'; }
  else if (exactLines) { card.classList.add('typing-progress'); status.textContent = `${exactLines} linha(s) de código corretas`; }
  else { card.classList.add('typing-error'); status.textContent = 'Ajuste a primeira linha de código'; }
}
function setExercise(index) { state.activeExercise = index; state.activeFile = 0; renderExercises(); renderFiles(); updateTypingFeedback(); $('#feedbackHeading').textContent = 'Aguardando envio'; $('#feedback').className = 'feedback empty'; $('#feedback').innerHTML = '<div class="empty-icon">✓</div><p>Digite o código e clique em <strong>Verificar este arquivo</strong>.</p>'; }

$('#exerciseList').addEventListener('click', event => { const button = event.target.closest('[data-exercise]'); if (button) setExercise(Number(button.dataset.exercise)); });
$('#fileTabs').addEventListener('click', event => { const button = event.target.closest('[data-file]'); if (!button) return; state.drafts[draftKey()] = editor.value; saved(); state.activeFile = Number(button.dataset.file); renderFiles(); updateTypingFeedback(); });
editor.addEventListener('input', () => { state.drafts[draftKey()] = editor.value; saved(); updateLineNumbers(); updateHighlight(); updateTypingFeedback(); });
editor.addEventListener('scroll', () => { $('#lineNumbers').scrollTop = editor.scrollTop; updateHighlight(); });
editor.addEventListener('keydown', event => { if (event.key === 'Tab') { event.preventDefault(); const start = editor.selectionStart, end = editor.selectionEnd; editor.setRangeText('    ', start, end, 'end'); editor.dispatchEvent(new Event('input')); } if (((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') || (event.shiftKey && event.key === 'Insert')) { event.preventDefault(); $('#keyboardTip').textContent = 'Colar está bloqueado. Digite o código diretamente no editor.'; } });
editor.addEventListener('paste', event => { event.preventDefault(); $('#keyboardTip').textContent = 'Colar está bloqueado. Digite o código diretamente no editor.'; });
editor.addEventListener('drop', event => { event.preventDefault(); $('#keyboardTip').textContent = 'Arrastar conteúdo também está bloqueado. Digite o código diretamente no editor.'; });
editor.addEventListener('contextmenu', event => event.preventDefault());
$('#checkButton').addEventListener('click', verifyFile); $('#submitButton').addEventListener('click', submitActivity); $('#clearButton').addEventListener('click', () => { if (editor.value && confirm('Limpar somente o conteúdo deste arquivo?')) { editor.value = ''; editor.dispatchEvent(new Event('input')); } });
$('#clearFeedback').addEventListener('click', () => { $('#feedbackHeading').textContent = 'Aguardando envio'; $('#feedback').className = 'feedback empty'; $('#feedback').innerHTML = '<div class="empty-icon">✓</div><p>Digite o código e clique em <strong>Verificar este arquivo</strong>.</p>'; });
$('#closeSubmission').addEventListener('click', () => { $('#submissionModal').hidden = true; });

function initialize(exercises) {
  state.exercises = exercises;
  renderExercises();
  renderFiles();
  updateProgress();
  updateTypingFeedback();
}

async function loadExercises() {
  try {
    if (location.protocol === 'file:' && Array.isArray(window.GABARITOS)) {
      return initialize(window.GABARITOS);
    }
    const response = await fetch('/api/exercises');
    if (!response.ok) throw new Error(`Erro ao carregar gabaritos (${response.status}).`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    initialize(data.exercises);
  } catch (error) {
    if (Array.isArray(window.GABARITOS)) return initialize(window.GABARITOS);
    $('#exerciseTitle').textContent = 'Não foi possível carregar os gabaritos';
    $('#feedback').className = 'feedback';
    $('#feedback').innerHTML = `<div class="result-summary warning">${escapeHTML(error.message)}</div>`;
  }
}

loadExercises();
