import CharacterRenderer from './renderers/CharacterRenderer';
import PositionerRenderer from './renderers/PositionerRenderer';
import Point from './models/Point';
import ZdtStrokeParser from './ZdtStrokeParser';
import Positioner from './Positioner';
import Quiz from './Quiz';
import {copyAndExtend} from './utils';
import Animator from './Animator';
import svg from 'svg.js';

const defaultOptions = {
  charDataLoader: (char) => global.hanziData[char],

  // positioning options

  width: null,
  height: null,
  padding: 20,

  // animation options

  strokeAnimationDuration: 300,
  strokeHighlightDuration: 200,
  delayBetweenStrokes: 1000,

  // colors

  strokeColor: '#555',
  highlightColor: '#AAF',
  hintColor: '#DDD',
  drawingColor: '#333',

  // undocumented obscure options

  drawingFadeDuration: 300,
  drawingWidth: 4,
  strokeWidth: 2,
  hintWidth: 2,
};

const defaultQuizOptions = {
  onMissedStroke: null,
  onCorrectStroke: null,
  onComplete: null,
  showOutline: true,
  showHintAfterMisses: 3,
  highlightOnComplete: true,
};

class HanziWriter {

  constructor(element, character, options = {}) {
    this._svg = svg(element);
    this.setOptions(options);
    this.setCharacter(character);
    this._setupListeners();
    this._animator = new Animator();
    this._quiz = null;
  }

  setOptions(options) {
    this._options = copyAndExtend(defaultOptions, options);
    this._mainCharOptions = {
      strokeColor: this._options.strokeColor,
      strokeWidth: this._options.strokeWidth,
      strokeAnimationDuration: this._options.strokeAnimationDuration,
      delayBetweenStrokes: this._options.delayBetweenStrokes,
    };
    this._outlineCharOptions = copyAndExtend(this._mainCharOptions, {
      strokeColor: this._options.hintColor,
      strokeWidth: this._options.hintWidth,
    });
    this._highlightCharOptions = copyAndExtend(this._mainCharOptions, {
      strokeColor: this._options.highlightColor,
      strokeAnimationDuration: this._options.strokeHighlightDuration,
    });
    this._userStrokeOptions = {
      strokeColor: this._options.drawingColor,
      strokeWidth: this._options.drawingWidth,
      fadeDuration: this._options.drawingFadeDuration,
    };
  }

  // ------ public API ------ //

  showCharacter(options = {}) {
    this._animate(animation => this._characterRenderer.show(animation));
  }
  hideCharacter(options = {}) {
    this._animate(animation => this._characterRenderer.hide(animation));
  }
  animateCharacter(options = {}) {
    this._animate(animation => this._characterRenderer.animate(animation));
  }

  showOutline(options = {}) {
    this._animate(animation => this._outlineRenderer.show(animation));
  }
  hideOutline(options = {}) {
    this._animate(animation => this._outlineRenderer.hide(animation));
  }

  quiz(quizOptions = {}) {
    this.cancelQuiz();
    this._quiz = new Quiz({
      canvas: this._canvas,
      animator: this._animator,
      character: this._character,
      characterRenderer: this._characterRenderer,
      outlineRenderer: this._outlineRenderer,
      highlightRenderer: this._highlightRenderer,
      quizOptions: copyAndExtend(defaultQuizOptions, quizOptions),
      userStrokeOptions: this._userStrokeOptions,
    });
  }

  cancelQuiz() {
    if (this._quiz) this._quiz.cancel();
    this._quiz = null;
  }

  setCharacter(char) {
    this.cancelQuiz();
    if (this._positionerRenderer) this._positionerRenderer.destroy();
    if (this._characterRenderer) this._characterRenderer.destroy();
    if (this._outlineRenderer) this._outlineRenderer.destroy();
    if (this._highlightRenderer) this._highlightRenderer.destroy();

    const pathStrings = this._options.charDataLoader(char);
    const zdtStrokeParser = new ZdtStrokeParser();
    this._character = zdtStrokeParser.generateCharacter(char, pathStrings);
    this._positioner = new Positioner(this._character, this._options);

    this._positionerRenderer = new PositionerRenderer(this._positioner).setCanvas(this._svg);
    this._canvas = this._positionerRenderer.getPositionedCanvas();

    this._outlineRenderer = new CharacterRenderer(this._character, this._outlineCharOptions).setCanvas(this._canvas).draw();
    this._characterRenderer = new CharacterRenderer(this._character, this._mainCharOptions).setCanvas(this._canvas).draw();
    this._highlightRenderer = new CharacterRenderer(this._character, this._highlightCharOptions).setCanvas(this._canvas).draw();
  }

  // ------------- //

  _setupListeners() {
    this._svg.node.addEventListener('mousedown', (evt) => {
      evt.preventDefault();
      this._forwardToQuiz('startUserStroke', this._getMousePoint(evt));
    });
    this._svg.node.addEventListener('touchstart', (evt) => {
      evt.preventDefault();
      this._forwardToQuiz('startUserStroke', this._getTouchPoint(evt));
    });
    this._svg.node.addEventListener('mousemove', (evt) => {
      evt.preventDefault();
      this._forwardToQuiz('continueUserStroke', this._getMousePoint(evt));
    });
    this._svg.node.addEventListener('touchmove', (evt) => {
      evt.preventDefault();
      this._forwardToQuiz('continueUserStroke', this._getTouchPoint(evt));
    });

    // TODO: fix
    document.addEventListener('mouseup', () => this._forwardToQuiz('endUserStroke'));
    document.addEventListener('touchend', () => this._forwardToQuiz('endUserStroke'));
  }

  _forwardToQuiz(method, ...args) {
    if (!this._quiz) return;
    this._quiz[method](...args);
  }

  _getMousePoint(evt) {
    return this._positioner.convertExternalPoint(new Point(evt.offsetX, evt.offsetY));
  }

  _getTouchPoint(evt) {
    const x = evt.touches[0].pageX - this._svg.node.offsetLeft;
    const y = evt.touches[0].pageY - this._svg.node.offsetTop;
    return this._positioner.convertExternalPoint(new Point(x, y));
  }

  _animate(func, options = {}) {
    this.cancelQuiz();
    return this._animator.animate(func, options);
  }
}

// set up window.HanziWriter if we're in the browser
if (typeof window !== 'undefined') {
  // store whatever used to be called HanziWriter in case of a conflict
  const previousHanziWriter = window.HanziWriter;

  // add a jQuery-esque noConflict method to restore the previous window.HanziWriter if necessary
  HanziWriter.noConflict = () => {
    window.HanziWriter = previousHanziWriter;
    return HanziWriter;
  };

  window.HanziWriter = HanziWriter;
}

// set up module.exports if we're in node/webpack
export default HanziWriter;
