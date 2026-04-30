/* ============================================
   CONSTITUIÇÃO QUIZ - SCRIPT.JS
   Jogo educativo de Direito Constitucional
   Memorização ativa com classificação + perguntas
   ============================================ */

// ==========================================
// MÓDULO: DADOS
// Carrega e gerencia os dados do JSON
// ==========================================
const Dados = {
  categorias: [],
  itens: {},
  perguntas: [],

  /** Carrega os dados do arquivo JSON externo */
  async carregar() {
    try {
      const resposta = await fetch('dados.json');
      if (!resposta.ok) throw new Error('Falha ao carregar dados.json');
      const dados = await resposta.json();
      this.categorias = dados.categorias || [];
      this.itens = dados.itens || {};
      this.perguntas = dados.perguntas || [];
      return dados;
    } catch (erro) {
      console.error('Erro ao carregar dados:', erro);
      throw erro;
    }
  }
};

// ==========================================
// MÓDULO: UTILIDADES
// Funções auxiliares reutilizáveis
// ==========================================
const Utils = {
  /** Embaralha um array (algoritmo Fisher-Yates) */
  embaralhar(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  /** Seleciona N itens aleatórios de um array */
  selecionarAleatorio(array, quantidade) {
    return Utils.embaralhar(array).slice(0, quantidade);
  },

  /** Formata tempo em segundos */
  formatarTempo(segundos) {
    return Math.max(0, Math.ceil(segundos));
  },

  /** Gera um número aleatório entre min e max */
  aleatorio(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
};

// ==========================================
// MÓDULO: ESTADO DO JOGO
// Gerencia o estado global da aplicação
// ==========================================
const Estado = {
  nivel: 1,
  pontuacao: 0,
  pontuacaoNivel: 0,
  tempoMaximo: 60,
  tempoRestante: 60,
  timerIntervalo: null,
  acertosNivel: 0,
  errosNivel: 0,
  acertosTotal: 0,
  errosTotal: 0,
  itensClassificados: new Map(), // itemId -> categoryId
  perguntasRespondidas: 0,
  perguntasNoNivel: 0,
  classificacoesNoNivel: 0,
  classificacoesFeitas: 0,
  faseAtual: 'classificacao', // 'classificacao' | 'pergunta'
  jogoAtivo: false,

  /** Configurações de dificuldade por nível */
  configNivel(nivel) {
    return {
      tempo: Math.max(30, 60 - (nivel - 1) * 5),      // 60s, 55s, 50s... mín 30s
      itensPorCategoria: Math.min(3 + nivel, 5),        // 4, 5, 6... máx 5
      categoriasAtivas: Math.min(2 + Math.floor(nivel / 2), 6), // 2, 2, 3, 3, 4... máx 6
      perguntasNoNivel: 2 + nivel,                      // 3, 4, 5...
      pontuacaoMinima: 100 * nivel                       // 100, 200, 300...
    };
  },

  /** Categorias disponíveis para o nível atual */
  getCategoriasAtivas() {
    const config = this.configNivel(this.nivel);
    return Utils.selecionarAleatorio(Dados.categorias, config.categoriasAtivas);
  },

  /** Reinicia estatísticas do nível */
  resetarNivel() {
    const config = this.configNivel(this.nivel);
    this.pontuacaoNivel = 0;
    this.tempoMaximo = config.tempo;
    this.tempoRestante = config.tempo;
    this.acertosNivel = 0;
    this.errosNivel = 0;
    this.itensClassificados = new Map();
    this.perguntasRespondidas = 0;
    this.perguntasNoNivel = config.perguntasNoNivel;
    this.classificacoesFeitas = 0;
  }
};

// ==========================================
// MÓDULO: UI
// Gerencia a interface do usuário
// ==========================================
const UI = {
  /** Referências aos elementos DOM */
  elementos: {},

  /** Inicializa as referências DOM */
  inicializar() {
    this.elementos = {
      loading: document.getElementById('loading-screen'),
      telaInicial: document.getElementById('tela-inicial'),
      instrucoes: document.getElementById('instructions-modal'),
      telaTransicao: document.getElementById('tela-transicao'),
      telaJogo: document.getElementById('tela-jogo'),
      telaNivelCompleto: document.getElementById('tela-nivel-completo'),
      telaGameOver: document.getElementById('tela-game-over'),
      // HUD
      hudNivel: document.getElementById('hud-nivel'),
      hudScore: document.getElementById('hud-score'),
      hudTimer: document.getElementById('hud-timer'),
      hudTimerContainer: document.getElementById('hud-timer-container'),
      timerBar: document.getElementById('timer-bar'),
      // Classificação
      modoClassificacao: document.getElementById('modo-classificacao'),
      itemsPool: document.getElementById('items-pool'),
      dropZones: document.getElementById('drop-zones'),
      btnVerificar: document.getElementById('btn-verificar'),
      // Perguntas
      modoPergunta: document.getElementById('modo-pergunta'),
      questionNumber: document.getElementById('question-number'),
      questionText: document.getElementById('question-text'),
      optionsList: document.getElementById('options-list'),
      explanation: document.getElementById('explanation'),
      explanationText: document.getElementById('explanation-text'),
      questionControls: document.getElementById('question-controls'),
      // Transição
      transicaoNivel: document.getElementById('transicao-nivel'),
      transicaoTitulo: document.getElementById('transicao-titulo'),
      transicaoInfo: document.getElementById('transicao-info'),
      transicaoTempo: document.getElementById('transicao-tempo'),
      transicaoItens: document.getElementById('transicao-itens'),
      transicaoMin: document.getElementById('transicao-min'),
      // Nível completo
      nivelCompletoTitulo: document.getElementById('nivel-completo-titulo'),
      nivelCompletoScore: document.getElementById('nivel-completo-score'),
      nivelAcertos: document.getElementById('nivel-acertos'),
      nivelErros: document.getElementById('nivel-erros'),
      nivelTempoRestante: document.getElementById('nivel-tempo-restante'),
      nivelBonus: document.getElementById('nivel-bonus'),
      nivelMensagem: document.getElementById('nivel-mensagem'),
      nivelControles: document.getElementById('nivel-controles'),
      // Game Over
      gameOverTitulo: document.getElementById('game-over-titulo'),
      gameOverScore: document.getElementById('game-over-score'),
      gameOverSubtitulo: document.getElementById('game-over-subtitulo'),
      performanceFill: document.getElementById('performance-fill'),
      performanceTexto: document.getElementById('performance-texto'),
      goNivel: document.getElementById('go-nivel'),
      goAcertos: document.getElementById('go-acertos'),
      goErros: document.getElementById('go-erros'),
      goPrecisao: document.getElementById('go-precisao')
    };
  },

  /** Exibe apenas a tela informada, escondendo as demais */
  mostrarTela(telaId) {
    const telas = ['loading', 'telaInicial', 'telaTransicao', 'telaJogo', 'telaNivelCompleto', 'telaGameOver'];
    telas.forEach(t => {
      const el = this.elementos[t];
      if (el) el.style.display = (t === telaId) ? '' : 'none';
    });
  },

  /** Mostra a tela de jogo com o modo específico */
  mostrarModoJogo(modo) {
    this.elementos.modoClassificacao.style.display = modo === 'classificacao' ? '' : 'none';
    this.elementos.modoPergunta.style.display = modo === 'pergunta' ? '' : 'none';
  },

  /** Atualiza o HUD com dados atuais */
  atualizarHUD() {
    this.elementos.hudNivel.textContent = Estado.nivel;
    this.elementos.hudScore.textContent = Estado.pontuacao;
    this.elementos.hudTimer.textContent = Estado.tempoRestante;

    // Atualiza barra de tempo
    const porcentagem = (Estado.tempoRestante / Estado.tempoMaximo) * 100;
    this.elementos.timerBar.style.width = porcentagem + '%';

    // Muda cor quando está acabando
    if (porcentagem <= 25) {
      this.elementos.hudTimerContainer.classList.add('warning');
      this.elementos.timerBar.classList.add('warning');
    } else {
      this.elementos.hudTimerContainer.classList.remove('warning');
      this.elementos.timerBar.classList.remove('warning');
    }
  },

  /** Mostra popup de pontuação temporário */
  mostrarPopupPontuacao(valor) {
    const popup = document.createElement('div');
    popup.className = 'score-popup ' + (valor > 0 ? 'positive' : 'negative');
    popup.textContent = (valor > 0 ? '+' : '') + valor;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 1500);
  },

  /** Mostra feedback visual temporário (correto/incorreto) */
  mostrarFeedback(correto) {
    const overlay = document.createElement('div');
    overlay.className = 'feedback-overlay ' + (correto ? 'feedback-correct' : 'feedback-incorrect');
    overlay.textContent = correto ? '✅ Correto!' : '❌ Incorreto!';
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 800);
  },

  /** Mostra modal de instruções */
  mostrarInstrucoes() {
    this.elementos.instrucoes.style.display = 'flex';
  },

  /** Fecha modal de instruções */
  fecharInstrucoes() {
    this.elementos.instrucoes.style.display = 'none';
  },

  /** Configura a tela de transição de nível */
  configurarTransicao() {
    const config = Estado.configNivel(Estado.nivel);
    this.elementos.transicaoNivel.textContent = Estado.nivel;
    this.elementos.transicaoTitulo.textContent = `Nível ${Estado.nivel}`;

    // Descreve o que vem pela frente
    const cats = Estado.getCategoriasAtivas();
    this.elementos.transicaoInfo.textContent =
      `Categorias: ${cats.map(c => c.nome).join(', ')}`;
    this.elementos.transicaoTempo.textContent = config.tempo + 's';
    this.elementos.transicaoItens.textContent =
      (config.itensPorCategoria * config.categoriasAtivas) + ' itens + ' + config.perguntasNoNivel + ' perguntas';
    this.elementos.transicaoMin.textContent = config.pontuacaoMinima;
  },

  /** Mostra tela de nível completo */
  mostrarNivelCompleto(passou) {
    const config = Estado.configNivel(Estado.nivel);
    const bonusTempo = Estado.tempoRestante * 5;

    this.elementos.nivelCompletoTitulo.textContent = passou ? '🎉 Nível Completo!' : '😞 Não foi dessa vez...';
    this.elementos.nivelCompletoScore.textContent = Estado.pontuacaoNivel;
    this.elementos.nivelAcertos.textContent = Estado.acertosNivel;
    this.elementos.nivelErros.textContent = Estado.errosNivel;
    this.elementos.nivelTempoRestante.textContent = Estado.tempoRestante + 's';
    this.elementos.nivelBonus.textContent = '+' + bonusTempo;

    if (passou) {
      this.elementos.nivelMensagem.textContent =
        `Pontuação mínima necessária: ${config.pontuacaoMinima}. Você avançou para o nível ${Estado.nivel + 1}!`;
      this.elementos.nivelControles.innerHTML =
        `<button class="btn btn-success" onclick="Game.proximoNivel()">Próximo Nível ➡️</button>`;
    } else {
      this.elementos.nivelMensagem.textContent =
        `Você precisava de ${config.pontuacaoMinima} pontos. Tente novamente!`;
      this.elementos.nivelControles.innerHTML =
        `<button class="btn btn-primary" onclick="Game.reiniciarNivel()">🔄 Tentar Novamente</button>`;
    }

    UI.mostrarTela('telaNivelCompleto');
  },

  /** Mostra tela de game over */
  mostrarGameOver() {
    const total = Estado.acertosTotal + Estado.errosTotal;
    const precisao = total > 0 ? Math.round((Estado.acertosTotal / total) * 100) : 0;

    this.elementos.gameOverTitulo.textContent = Estado.nivel >= 5 ? '🏆 Parabéns, Mestre!' : '📝 Fim de Jogo';
    this.elementos.gameOverScore.textContent = Estado.pontuacao;
    this.elementos.gameOverSubtitulo.textContent =
      Estado.nivel >= 5 ? 'Você dominou os principais artigos!' : `Você alcançou o nível ${Estado.nivel}`;
    this.elementos.goNivel.textContent = Estado.nivel;
    this.elementos.goAcertos.textContent = Estado.acertosTotal;
    this.elementos.goErros.textContent = Estado.errosTotal;
    this.elementos.goPrecisao.textContent = precisao + '%';

    // Barra de desempenho
    const performancePct = Math.min(100, precisao);
    const cor = performancePct >= 70 ? '#10b981' : performancePct >= 40 ? '#f59e0b' : '#ef4444';
    this.elementos.performanceFill.style.width = '0%';
    this.elementos.performanceFill.style.background = cor;
    setTimeout(() => {
      this.elementos.performanceFill.style.width = performancePct + '%';
    }, 100);
    this.elementos.performanceTexto.textContent =
      performancePct >= 80 ? 'Excelente! Você tem domínio sólido do conteúdo!' :
      performancePct >= 60 ? 'Bom desempenho! Continue estudando!' :
      performancePct >= 40 ? 'Continue praticando, você está no caminho!' :
      'Revise os artigos e tente novamente!';

    UI.mostrarTela('telaGameOver');
  }
};

// ==========================================
// MÓDULO: TIMER
// Gerencia contagem regressiva
// ==========================================
const Timer = {
  /** Inicia o timer com contagem regressiva */
  iniciar() {
    this.parar();
    Estado.tempoRestante = Estado.tempoMaximo;
    UI.atualizarHUD();

    Estado.timerIntervalo = setInterval(() => {
      Estado.tempoRestante--;
      UI.atualizarHUD();

      if (Estado.tempoRestante <= 0) {
        this.parar();
        Game.tempoEsgotado();
      }
    }, 1000);
  },

  /** Para o timer */
  parar() {
    if (Estado.timerIntervalo) {
      clearInterval(Estado.timerIntervalo);
      Estado.timerIntervalo = null;
    }
  },

  /** Adiciona tempo bônus */
  adicionarBonus(segundos) {
    Estado.tempoRestante = Math.min(Estado.tempoRestante + segundos, Estado.tempoMaximo);
    UI.atualizarHUD();
  }
};

// ==========================================
// MÓDULO: DRAG & DROP
// Gerencia arrastar e soltar (desktop + touch)
// ==========================================
const DragDrop = {
  itemArrastado: null,

  /** Inicializa o sistema de drag & drop */
  inicializar() {
    // Eventos globais para desktop
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());
  },

  /** Cria um item arrastável */
  criarItem(item, categoriaId) {
    const el = document.createElement('div');
    el.className = 'draggable-item fade-in';
    el.draggable = true;
    el.textContent = item.texto;
    el.dataset.id = item.texto;
    el.dataset.categoriaCorreta = categoriaId;
    el.dataset.dica = item.dica || '';

    // Eventos de drag (desktop)
    el.addEventListener('dragstart', (e) => {
      DragDrop.itemArrastado = el;
      el.classList.add('dragging');
      e.dataTransfer.setData('text/plain', item.texto);
      e.dataTransfer.effectAllowed = 'move';
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      DragDrop.itemArrastado = null;
    });

    // Eventos de toque (mobile)
    el.addEventListener('touchstart', DragDrop.handleTouchStart, { passive: false });
    el.addEventListener('touchmove', DragDrop.handleTouchMove, { passive: false });
    el.addEventListener('touchend', DragDrop.handleTouchEnd, { passive: false });

    return el;
  },

  /** Cria uma zona de drop */
  criarZonaDrop(categoria) {
    const zona = document.createElement('div');
    zona.className = 'drop-zone';
    zona.style.borderColor = categoria.cor + '40';
    zona.dataset.categoria = categoria.id;

    const titulo = document.createElement('div');
    titulo.className = 'drop-zone-title';
    titulo.style.color = categoria.cor;
    titulo.textContent = categoria.nome;

    const itensContainer = document.createElement('div');
    itensContainer.className = 'drop-zone-items';

    zona.appendChild(titulo);
    zona.appendChild(itensContainer);

    // Eventos de drop (desktop)
    zona.addEventListener('dragover', (e) => {
      e.preventDefault();
      zona.classList.add('drag-over');
    });

    zona.addEventListener('dragleave', () => {
      zona.classList.remove('drag-over');
    });

    zona.addEventListener('drop', (e) => {
      e.preventDefault();
      zona.classList.remove('drag-over');
      if (DragDrop.itemArrastado) {
        DragDrop.soltarItem(DragDrop.itemArrastado, itensContainer, categoria.id);
      }
    });

    // Permitir clique para selecionar e clicar na zona para colocar (mobile)
    zona.addEventListener('click', () => {
      const selecionado = document.querySelector('.draggable-item.selecionado');
      if (selecionado) {
        DragDrop.soltarItem(selecionado, itensContainer, categoria.id);
      }
    });

    return zona;
  },

  /** Manipula o toque inicial */
  handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const item = e.currentTarget;

    // Seleciona visualmente
    document.querySelectorAll('.draggable-item.selecionado').forEach(i => i.classList.remove('selecionado'));
    item.classList.add('selecionado');
    item.style.position = 'fixed';
    item.style.zIndex = '1000';
    item.style.width = item.offsetWidth + 'px';

    function moverTouch(ev) {
      ev.preventDefault();
      const t = ev.touches[0];
      item.style.left = (t.clientX - item.offsetWidth / 2) + 'px';
      item.style.top = (t.clientY - item.offsetHeight / 2) + 'px';
    }

    function soltarTouch(ev) {
      ev.preventDefault();
      item.style.position = '';
      item.style.zIndex = '';
      item.style.left = '';
      item.style.top = '';
      item.style.width = '';

      const t = ev.changedTouches[0];
      const elemSob = document.elementFromPoint(t.clientX, t.clientY);
      const zona = elemSob?.closest('.drop-zone');

      if (zona) {
        const itensContainer = zona.querySelector('.drop-zone-items');
        const catId = zona.dataset.categoria;
        DragDrop.soltarItem(item, itensContainer, catId);
      }

      item.removeEventListener('touchmove', moverTouch);
      item.removeEventListener('touchend', soltarTouch);
    }

    item.addEventListener('touchmove', moverTouch, { passive: false });
    item.addEventListener('touchend', soltarTouch, { passive: false });
  },

  handleTouchMove(e) { e.preventDefault(); },
  handleTouchEnd(e) { e.preventDefault(); },

  /** Move um item para uma zona de drop */
  soltarItem(itemEl, container, categoriaId) {
    // Remove da pool anterior
    if (itemEl.parentElement && itemEl.parentElement.id === 'items-pool') {
      itemEl.remove();
    } else if (itemEl.parentElement) {
      itemEl.remove();
    }

    // Remove seleção
    itemEl.classList.remove('selecionado');

    // Adiciona à zona
    container.appendChild(itemEl);

    // Registra classificação
    Estado.itensClassificados.set(itemEl.dataset.id, categoriaId);
  }
};

// ==========================================
// MÓDULO: CLASSIFICAÇÃO
// Gerencia o modo de classificação por drag & drop
// ==========================================
const Classificacao = {
  /** Prepara e exibe a fase de classificação */
  preparar() {
    Estado.faseAtual = 'classificacao';
    UI.mostrarModoJogo('classificacao');

    const categorias = Estado.getCategoriasAtivas();
    const config = Estado.configNivel(Estado.nivel);

    // Limpa containers
    UI.elementos.itemsPool.innerHTML = '';
    UI.elementos.dropZones.innerHTML = '';
    Estado.itensClassificados.clear();

    // Cria zonas de drop
    categorias.forEach(cat => {
      const zona = DragDrop.criarZonaDrop(cat);
      UI.elementos.dropZones.appendChild(zona);
    });

    // Coleta itens das categorias ativas
    let todosItens = [];
    categorias.forEach(cat => {
      const itensDaCategoria = Dados.itens[cat.id] || [];
      const selecionados = Utils.selecionarAleatorio(itensDaCategoria, config.itensPorCategoria);
      selecionados.forEach(item => {
        todosItens.push({ ...item, categoriaId: cat.id });
      });
    });

    // Embaralha os itens
    todosItens = Utils.embaralhar(todosItens);
    Estado.classificacoesNoNivel = todosItens.length;

    // Cria os itens arrastáveis
    todosItens.forEach(item => {
      const el = DragDrop.criarItem(item, item.categoriaId);
      UI.elementos.itemsPool.appendChild(el);
    });

    // Re-inicializa o botão de verificar
    UI.elementos.btnVerificar.disabled = false;
    UI.elementos.btnVerificar.textContent = '✅ Verificar';
  },

  /** Verifica a classificação dos itens */
  verificar() {
    let acertos = 0;
    let erros = 0;

    // Para cada item classificado, verifica se está na categoria correta
    const dropZones = document.querySelectorAll('.drop-zone');
    dropZones.forEach(zona => {
      const zonaCat = zona.dataset.categoria;
      const itensNaZona = zona.querySelectorAll('.drop-zone-items .draggable-item');

      itensNaZona.forEach(item => {
        const correta = item.dataset.categoriaCorreta;
        if (correta === zonaCat) {
          item.classList.add('correct');
          item.classList.remove('incorrect');
          acertos++;
        } else {
          item.classList.add('incorrect');
          item.classList.remove('correct');
          erros++;
        }
      });
    });

    // Itens ainda na pool são erros
    const itensNaPool = UI.elementos.itemsPool.querySelectorAll('.draggable-item');
    erros += itensNaPool.length;

    // Calcula pontuação: acerto = +30, erro = -15
    const pontos = (acertos * 30) - (erros * 15);
    Estado.pontuacaoNivel += Math.max(pontos, 0);
    Estado.pontuacao += Math.max(pontos, 0);
    Estado.acertosNivel += acertos;
    Estado.errosNivel += erros;
    Estado.acertosTotal += acertos;
    Estado.errosTotal += erros;

    UI.mostrarFeedback(pontos > 0);
    if (pontos > 0) UI.mostrarPopupPontuacao(pontos);

    UI.atualizarHUD();

    // Desabilita verificação após uso
    UI.elementos.btnVerificar.disabled = true;

    // Após 1.5s, avança para próxima fase
    setTimeout(() => {
      Game.iniciarPerguntas();
    }, 1500);
  }
};

// ==========================================
// MÓDULO: PERGUNTAS
// Gerencia o modo de perguntas múltipla escolha
// ==========================================
const Perguntas = {
  perguntasDoNivel: [],
  indiceAtual: 0,

  /** Prepara e exibe a fase de perguntas */
  preparar() {
    Estado.faseAtual = 'pergunta';
    UI.mostrarModoJogo('pergunta');

    // Seleciona perguntas aleatórias baseadas no nível
    const config = Estado.configNivel(Estado.nivel);

    // Filtra perguntas por dificuldade <= nível
    let perguntasDisponiveis = Dados.perguntas.filter(
      p => p.dificuldade <= Estado.nivel
    );

    // Se não tem suficientes, pega todas
    if (perguntasDisponiveis.length < config.perguntasNoNivel) {
      perguntasDisponiveis = Dados.perguntas;
    }

    this.perguntasDoNivel = Utils.selecionarAleatorio(perguntasDisponiveis, config.perguntasNoNivel);
    this.indiceAtual = 0;

    // Embaralha as opções de cada pergunta
    this.perguntasDoNivel.forEach(p => {
      // Guarda o índice correto original
      p.indiceCorretoOriginal = p.correta;
      p.opcoesEmbaralhadas = Utils.embaralhar(p.opcoes.map((texto, i) => ({
        texto,
        eraCorreta: i === p.correta
      })));
    });

    this.mostrarPergunta();
  },

  /** Exibe a pergunta atual */
  mostrarPergunta() {
    if (this.indiceAtual >= this.perguntasDoNivel.length) {
      // Todas perguntas respondidas
      Game.finalizarNivel();
      return;
    }

    const pergunta = this.perguntasDoNivel[this.indiceAtual];
    const total = this.perguntasDoNivel.length;

    UI.elementos.questionNumber.textContent =
      `Pergunta ${this.indiceAtual + 1} de ${total} — Nível ${Estado.nivel}`;
    UI.elementos.questionText.textContent = pergunta.enunciado;
    UI.elementos.explanation.style.display = 'none';
    UI.elementos.questionControls.style.display = 'none';

    // Cria botões de opção
    const letras = ['A', 'B', 'C', 'D', 'E'];
    UI.elementos.optionsList.innerHTML = '';

    pergunta.opcoesEmbaralhadas.forEach((opcao, i) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.innerHTML = `
        <span class="option-letter">${letras[i]}</span>
        <span>${opcao.texto}</span>
      `;
      btn.addEventListener('click', () => this.responder(i, btn));
      UI.elementos.optionsList.appendChild(btn);
    });
  },

  /** Processa a resposta do jogador */
  responder(indice, btnElement) {
    const pergunta = this.perguntasDoNivel[this.indiceAtual];
    const opcoes = pergunta.opcoesEmbaralhadas;
    const correta = opcoes[indice].eraCorreta;

    // Desabilita todos os botões
    const todosBtns = UI.elementos.optionsList.querySelectorAll('.option-btn');
    todosBtns.forEach((btn, i) => {
      btn.disabled = true;
      if (opcoes[i].eraCorreta) {
        btn.classList.add('correct-answer');
      }
    });

    if (correta) {
      btnElement.classList.add('correct-answer');
      Estado.acertosNivel++;
      Estado.acertosTotal++;

      // Pontuação: base 50 + bônus de tempo
      const bonusTempo = Math.floor(Estado.tempoRestante / 2);
      const pontos = 50 + bonusTempo;
      Estado.pontuacaoNivel += pontos;
      Estado.pontuacao += pontos;

      UI.mostrarFeedback(true);
      UI.mostrarPopupPontuacao(pontos);
    } else {
      btnElement.classList.add('wrong-answer');
      Estado.errosNivel++;
      Estado.errosTotal++;

      // Penalidade
      Estado.pontuacaoNivel -= 20;
      Estado.pontuacao -= 20;

      UI.mostrarFeedback(false);
      UI.mostrarPopupPontuacao(-20);
    }

    // Mostra explicação
    UI.elementos.explanationText.textContent = pergunta.explicacao;
    UI.elementos.explanation.style.display = '';

    // Mostra botão para próxima
    UI.elementos.questionControls.style.display = 'flex';
    if (this.indiceAtual >= this.perguntasDoNivel.length - 1) {
      UI.elementos.questionControls.innerHTML =
        '<button class="btn btn-primary" onclick="Game.finalizarNivel()">📊 Ver Resultado</button>';
    }

    UI.atualizarHUD();
    Estado.perguntasRespondidas++;
  },

  /** Avança para a próxima pergunta */
  proxima() {
    this.indiceAtual++;
    this.mostrarPergunta();
  }
};

// ==========================================
// MÓDULO: GAME
// Controlador principal do jogo
// ==========================================
const Game = {
  /** Inicializa o jogo */
  async inicializar() {
    UI.inicializar();
    DragDrop.inicializar();

    try {
      await Dados.carregar();
      UI.mostrarTela('telaInicial');
    } catch (erro) {
      UI.elementos.loading.innerHTML = `
        <p style="color:#ef4444;">❌ Erro ao carregar dados.json</p>
        <p style="color:#94a3b8;">Verifique se o arquivo está na mesma pasta.</p>
        <button class="btn btn-primary" onclick="location.reload()">🔄 Recarregar</button>
      `;
    }
  },

  /** Inicia uma nova partida */
  iniciar() {
    Estado.nivel = 1;
    Estado.pontuacao = 0;
    Estado.acertosTotal = 0;
    Estado.errosTotal = 0;
    Estado.jogoAtivo = true;

    this.mostrarTransicao();
  },

  /** Reinicia o jogo do início */
  reiniciar() {
    this.iniciar();
  },

  /** Mostra tela de transição para o nível atual */
  mostrarTransicao() {
    UI.configurarTransicao();
    UI.mostrarTela('telaTransicao');
  },

  /** Começa efetivamente o nível atual */
  comecarNivel() {
    Estado.resetarNivel();
    UI.mostrarTela('telaJogo');
    UI.atualizarHUD();

    // Inicia com classificação
    this.iniciarClassificacao();
  },

  /** Reinicia o nível atual (em caso de reprovação) */
  reiniciarNivel() {
    Estado.pontuacao -= Estado.pontuacaoNivel; // Remove pontos do nível falho
    Estado.acertosTotal -= Estado.acertosNivel;
    Estado.errosTotal -= Estado.errosNivel;
    Estado.pontuacaoNivel = 0;
    Estado.acertosNivel = 0;
    Estado.errosNivel = 0;

    UI.mostrarTela('telaTransicao');
    UI.configurarTransicao();
  },

  /** Inicia a fase de classificação */
  iniciarClassificacao() {
    Timer.iniciar();
    Classificacao.preparar();
  },

  /** Inicia a fase de perguntas */
  iniciarPerguntas() {
    Perguntas.preparar();
  },

  /** Verifica classificação (chamado pelo botão) */
  verificarClassificacao() {
    Classificacao.verificar();
  },

  /** Avança para próxima pergunta */
  proximaPergunta() {
    Perguntas.proxima();
  },

  /** Pula a fase atual com penalidade */
  pularFase() {
    Estado.pontuacao -= 50;
    Estado.pontuacaoNivel -= 50;
    UI.atualizarHUD();
    UI.mostrarPopupPontuacao(-50);

    if (Estado.faseAtual === 'classificacao') {
      this.iniciarPerguntas();
    } else {
      this.finalizarNivel();
    }
  },

  /** Tempo esgotado */
  tempoEsgotado() {
    Estado.jogoAtivo = false;

    // Penalidade por tempo
    Estado.pontuacaoNivel -= 30;
    Estado.pontuacao -= 30;
    UI.atualizarHUD();
    UI.mostrarPopupPontuacao(-30);

    // Finaliza o nível
    this.finalizarNivel();
  },

  /** Finaliza o nível atual */
  finalizarNivel() {
    Timer.parar();
    Estado.jogoAtivo = false;

    const config = Estado.configNivel(Estado.nivel);

    // Bônus de tempo restante
    const bonusTempo = Estado.tempoRestante * 5;
    Estado.pontuacaoNivel += bonusTempo;
    Estado.pontuacao += bonusTempo;

    // Verifica se passou
    const passou = Estado.pontuacaoNivel >= config.pontuacaoMinima;

    UI.mostrarNivelCompleto(passou);
  },

  /** Avança para o próximo nível */
  proximoNivel() {
    Estado.nivel++;
    Estado.pontuacaoNivel = 0;
    Estado.acertosNivel = 0;
    Estado.errosNivel = 0;

    if (Estado.nivel > 5) {
      // Completou todos os níveis!
      UI.mostrarGameOver();
      return;
    }

    this.mostrarTransicao();
  }
};

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  Game.inicializar();
});
