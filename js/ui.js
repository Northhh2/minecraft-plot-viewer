import { state } from './state.js';
import { getColorForType } from './utils.js';

let appData;
let dom;

export function initializeUI(data) {
    appData = data;
    dom = {
        modal: document.getElementById('modal'),
        modalTitle: document.getElementById('modal-title'),
        modalContent: document.getElementById('modal-content'),
        closeModalBtn: document.getElementById('close-modal'),
        backModalBtn: document.getElementById('back-modal'),
        loginButton: document.getElementById('login-button'),
        profileButton: document.getElementById('profile-button'),
        profilePic: document.getElementById('profile-pic'),
        loginModal: document.getElementById('login-modal'),
        closeLoginModalButton: document.getElementById('close-login-modal'),
        loginForm: document.getElementById('login-form'),
        loginError: document.getElementById('login-error'),
        lotteryButton: document.getElementById('lottery-button'),
        lotteryOverlay: document.getElementById('lottery-overlay'),
        closeLotteryButton: document.getElementById('close-lottery-button'),
        wheelCanvas: document.getElementById('wheelCanvas'),
        spinButton: document.getElementById('spin-button'),
        lotteryResult: document.getElementById('lottery-result'),
    };
    
    setupEventListeners();
    setupLottery();
    attemptAutoLogin();
}

function setupEventListeners() {
    dom.closeModalBtn.addEventListener('click', closeModal);
    dom.backModalBtn.addEventListener('click', goBackModal);
    
    dom.loginButton.addEventListener('click', () => dom.loginModal.classList.remove('hidden'));
    dom.profileButton.addEventListener('click', () => {
        if (state.currentUser) openNewModal({ type: 'owner', data: state.currentUser.name });
    });
    dom.closeLoginModalButton.addEventListener('click', () => {
        dom.loginModal.classList.add('hidden');
        dom.loginError.classList.add('hidden');
    });
    dom.loginForm.addEventListener('submit', handleLogin);
    
    dom.lotteryButton.addEventListener('click', openLottery);
    dom.closeLotteryButton.addEventListener('click', () => dom.lotteryOverlay.classList.add('hidden'));
    dom.spinButton.addEventListener('click', spinWheel);
}

// ... (reszta funkcji UI: modal, auth, lottery, search)
