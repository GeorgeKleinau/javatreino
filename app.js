const state = { exercises: [], activeExercise: 0, activeFile: 0, drafts: JSON.parse(localStorage.getItem('codetype-drafts') || '{}') };
const $ = selector => document.querySelector(selector);
const editor = $('#codeEditor');
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
  const expected = state.exercises.length ? file().code.split('\n') : [];
  $('#lineNumbers').innerHTML = Array.from({ length: Math.max(1, typed.length) }, (_, index) => {
    const status = !editor.value ? '' : typed[index] === expected[index] ? ' correct' : ' incorrect';
    return `<span class="line-number${status}">${index + 1}</span>`;
  }).join('\n');
  $('#lineNumbers').scrollTop = editor.scrollTop;
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
}
function normalize(text) { return text.replace(/\r\n/g, '\n').replace(/\n$/, ''); }
function firstDifference(expected, typed) {
  const limit = Math.min(expected.length, typed.length);
  for (let index = 0; index < limit; index++) if (expected[index] !== typed[index]) return index + 1;
  return limit + 1;
}
function analyze(expected, actual) {
  const wanted = normalize(expected).split('\n');
  const typed = normalize(actual).split('\n');
  const issues = [];
  const max = Math.max(wanted.length, typed.length);
  for (let index = 0; index < max; index++) {
    if (wanted[index] === typed[index]) continue;
    let reason;
    if (typed[index] === undefined) reason = 'Linha faltando.';
    else if (wanted[index] === undefined) reason = 'Linha extra.';
    else if (wanted[index].toLocaleLowerCase('pt-BR') === typed[index].toLocaleLowerCase('pt-BR')) reason = 'Maiúsculas/minúsculas diferentes (a comparação é case sensitive).';
    else if (wanted[index].trim() === typed[index].trim()) reason = 'Indentação ou espaços diferentes.';
    else if (wanted[index].replace(/\s/g, '') === typed[index].replace(/\s/g, '')) reason = 'Espaços em posição diferente.';
    else reason = `Texto diferente a partir do caractere ${firstDifference(wanted[index], typed[index])}.`;
    issues.push({ line: index + 1, reason, expected: wanted[index], typed: typed[index] });
  }
  return { total: wanted.length, issues };
}
function showResult(result, scope = 'arquivo') {
  const feedback = $('#feedback');
  const heading = $('#feedbackHeading');
  if (!result.issues.length) {
    heading.textContent = scope === 'atividade' ? 'Atividade concluída!' : 'Arquivo correto!';
    feedback.className = 'feedback';
    feedback.innerHTML = `<div class="all-success"><div class="empty-icon">✓</div><strong>${scope === 'atividade' ? 'Excelente! Todos os arquivos foram digitados corretamente.' : `As ${result.total} linhas estão idênticas ao gabarito.`}</strong><p>Você pode seguir para o próximo arquivo ou atividade.</p></div>`;
    return;
  }
  heading.textContent = `${result.issues.length} ajuste${result.issues.length > 1 ? 's' : ''} encontrado${result.issues.length > 1 ? 's' : ''}`;
  const visible = result.issues.slice(0, 8);
  feedback.className = 'feedback';
  feedback.innerHTML = `<div class="result-summary warning">A correção é literal e diferencia maiúsculas de minúsculas. Veja exatamente o esperado e o que foi digitado.</div><div class="issue-list">${visible.map(issue => `<div class="issue ${issue.expected === undefined ? 'correct-line' : ''}"><strong>Linha ${issue.line}</strong> — ${issue.reason}${issue.expected !== undefined ? `<code>Esperado: ${escapeHTML(issue.expected || '(linha em branco)')}</code>` : ''}${issue.typed !== undefined ? `<code>Digitado: ${escapeHTML(issue.typed || '(linha em branco)')}</code>` : ''}</div>`).join('')}</div>${result.issues.length > visible.length ? `<p class="more">E mais ${result.issues.length - visible.length} linha(s) para revisar.</p>` : ''}`;
}
function verifyFile() {
  state.drafts[draftKey()] = editor.value; saved();
  showResult(analyze(file().code, editor.value)); renderExercises(); updateProgress();
}
function submitActivity() {
  state.drafts[draftKey()] = editor.value; saved();
  const mistakes = exercise().files.flatMap(source => analyze(source.code, state.drafts[`${exercise().id}/${source.path}`] || '').issues.map(issue => ({ ...issue, source: source.name })));
  if (!mistakes.length) showResult({ total: exercise().files.reduce((sum, source) => sum + source.code.split('\n').length, 0), issues: [] }, 'atividade');
  else { showResult({ total: 0, issues: mistakes }, 'atividade'); $('#feedbackHeading').textContent = `${mistakes.length} ajuste(s) na atividade`; }
  renderExercises(); updateProgress();
  const report = exercise().files.map(source => `// ${source.path}\n${state.drafts[`${exercise().id}/${source.path}`] || '(arquivo não digitado)'}`).join('\n\n');
  const subject = `Atividade Java — ${displayTitle(exercise())}`;
  window.location.href = `mailto:george.vasconcelos@ulife.com.br?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(report)}`;
}
function updateTypingFeedback() {
  const card = document.querySelector('.editor-card');
  const status = $('#typingStatus');
  const typed = editor.value;
  card.classList.remove('typing-correct', 'typing-progress', 'typing-error');
  if (!typed) { status.textContent = 'Aguardando digitação'; return; }
  const result = analyze(file().code, typed);
  const lines = typed.split('\n');
  const expected = file().code.split('\n');
  const lastLine = lines.length - 1;
  const exactLines = lines.filter((line, index) => line === expected[index]).length;
  if (!result.issues.length) { card.classList.add('typing-correct'); status.textContent = 'Código idêntico ao gabarito'; }
  else if (lines[lastLine] === expected[lastLine]) { card.classList.add('typing-progress'); status.textContent = `${exactLines} linha(s) corretas`; }
  else { card.classList.add('typing-error'); status.textContent = `Ajuste a linha ${lastLine + 1}`; }
}
function setExercise(index) { state.activeExercise = index; state.activeFile = 0; renderExercises(); renderFiles(); updateTypingFeedback(); $('#feedbackHeading').textContent = 'Aguardando envio'; $('#feedback').className = 'feedback empty'; $('#feedback').innerHTML = '<div class="empty-icon">✓</div><p>Digite o código e clique em <strong>Verificar este arquivo</strong>.</p>'; }

$('#exerciseList').addEventListener('click', event => { const button = event.target.closest('[data-exercise]'); if (button) setExercise(Number(button.dataset.exercise)); });
$('#fileTabs').addEventListener('click', event => { const button = event.target.closest('[data-file]'); if (!button) return; state.drafts[draftKey()] = editor.value; saved(); state.activeFile = Number(button.dataset.file); renderFiles(); updateTypingFeedback(); });
editor.addEventListener('input', () => { state.drafts[draftKey()] = editor.value; saved(); updateLineNumbers(); updateTypingFeedback(); });
editor.addEventListener('scroll', () => { $('#lineNumbers').scrollTop = editor.scrollTop; });
editor.addEventListener('keydown', event => { if (event.key === 'Tab') { event.preventDefault(); const start = editor.selectionStart, end = editor.selectionEnd; editor.setRangeText('    ', start, end, 'end'); editor.dispatchEvent(new Event('input')); } if (((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') || (event.shiftKey && event.key === 'Insert')) { event.preventDefault(); $('#keyboardTip').textContent = 'Colar está bloqueado. Digite o código diretamente no editor.'; } });
editor.addEventListener('paste', event => { event.preventDefault(); $('#keyboardTip').textContent = 'Colar está bloqueado. Digite o código diretamente no editor.'; });
editor.addEventListener('drop', event => { event.preventDefault(); $('#keyboardTip').textContent = 'Arrastar conteúdo também está bloqueado. Digite o código diretamente no editor.'; });
editor.addEventListener('contextmenu', event => event.preventDefault());
$('#checkButton').addEventListener('click', verifyFile); $('#submitButton').addEventListener('click', submitActivity); $('#clearButton').addEventListener('click', () => { if (editor.value && confirm('Limpar somente o conteúdo deste arquivo?')) { editor.value = ''; editor.dispatchEvent(new Event('input')); } });
$('#clearFeedback').addEventListener('click', () => { $('#feedbackHeading').textContent = 'Aguardando envio'; $('#feedback').className = 'feedback empty'; $('#feedback').innerHTML = '<div class="empty-icon">✓</div><p>Digite o código e clique em <strong>Verificar este arquivo</strong>.</p>'; });

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
