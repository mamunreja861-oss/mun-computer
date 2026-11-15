/**
 * js/login.js - Advanced Secure Login & Access Control Controller
 * MUN COMPUTER BUSINESS MANAGER
 */

import { authenticateAsync, changePasswordAsync, getCurrentUser, logout, ROLES, MANAGER_UID, STAFF_UID_PREFIX } from './auth.js';
import { initializeStorage, getItem, setItem, KEYS } from './storage.js';

// Initialize storage seed data if empty
initializeStorage();

const REMEMBER_UID_KEY = 'MUN_remembered_uid';

document.addEventListener('DOMContentLoaded', () => {
  initLoginPage();
});

function initLoginPage() {
  // Elements
  const tabManager = document.getElementById('tab-manager');
  const tabStaff = document.getElementById('tab-staff');
  const roleIndicatorChip = document.getElementById('role-indicator-chip');
  const roleIndicatorText = document.getElementById('role-indicator-text');
  const labelUid = document.getElementById('label-uid');
  const uidIconDisplay = document.getElementById('uid-icon-display');
  const uidInput = document.getElementById('login-uid');
  const uidHelperText = document.getElementById('uid-helper-text');
  const passwordInput = document.getElementById('login-password');
  const rememberCheckbox = document.getElementById('remember-me');
  const togglePwdBtn = document.getElementById('btn-toggle-pwd');
  const clearUserInputBtn = document.getElementById('btn-clear-user');
  const submitBtn = document.getElementById('btn-submit-login');
  const alertBox = document.getElementById('login-alert');
  const copyrightYear = document.getElementById('copyright-year');
  const form = document.getElementById('corporate-login-form');

  // Password Change Modal
  const pwdChangeModal = document.getElementById('password-change-modal');
  const pwdChangeForm = document.getElementById('pwd-change-form');
  const changeUserUid = document.getElementById('change-user-uid');
  const changeUidDisplay = document.getElementById('change-uid-display');
  const changeCurrentPwd = document.getElementById('change-current-pwd');
  const changeNewPwd = document.getElementById('change-new-pwd');
  const changeConfirmPwd = document.getElementById('change-confirm-pwd');
  const pwdChangeAlert = document.getElementById('pwd-change-alert');
  const btnCancelPwdChange = document.getElementById('btn-cancel-pwd-change');

  // Registration Modal
  const regModal = document.getElementById('registration-modal');
  const btnOpenRegister = document.getElementById('btn-open-register');
  const btnCloseRegister = document.getElementById('btn-close-register');
  const regForm = document.getElementById('registration-form');
  const regName = document.getElementById('reg-name');
  const regPhone = document.getElementById('reg-phone');
  const regOtpSection = document.getElementById('reg-otp-section');
  const regOtpInput = document.getElementById('reg-otp');
  const regOtpStatus = document.getElementById('reg-otp-status');
  const regOtpTimer = document.getElementById('reg-otp-timer');
  const regTimerCountdown = document.getElementById('reg-timer-countdown');
  const btnSendRegOtp = document.getElementById('btn-send-reg-otp');
  const btnResendRegOtp = document.getElementById('btn-resend-reg-otp');
  const btnVerifyRegOtp = document.getElementById('btn-verify-reg-otp');
  const btnSubmitRegister = document.getElementById('btn-submit-register');
  const regAlert = document.getElementById('register-alert');

  // Recovery (Forgot Password) Modal
  const recoveryModal = document.getElementById('recovery-modal');
  const linkForgotPwd = document.getElementById('link-forgot-pwd');
  const btnCloseRecovery = document.getElementById('btn-close-recovery');
  const recoveryAlert = document.getElementById('recovery-alert');
  const recoveryFormStep1 = document.getElementById('recovery-form-step1');
  const recoveryFormStep2 = document.getElementById('recovery-form-step2');
  const recoveryIdentity = document.getElementById('recovery-identity');
  const recOtpInput = document.getElementById('rec-otp-input');
  const btnVerifyRecOtp = document.getElementById('btn-verify-rec-otp');
  const recOtpStatus = document.getElementById('rec-otp-status');
  const recPasswordFields = document.getElementById('rec-password-fields');
  const recNewPwd = document.getElementById('rec-new-pwd');
  const recConfirmPwd = document.getElementById('rec-confirm-pwd');
  const recVerifiedPhone = document.getElementById('rec-verified-phone');
  const recVerifiedToken = document.getElementById('rec-verified-token');

  let currentRoleSelection = 'MANAGER'; // 'MANAGER' or 'STAFF'
  let regVerifiedToken = null;
  let regCooldownTimer = null;

  // Set copyright
  if (copyrightYear) copyrightYear.textContent = new Date().getFullYear();

  // Active Session check
  checkActiveSession();

  // Restore remembered UID if available
  const currentYearStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 4) || '2026';
  const staffUidPrefill = `MC-STF-${currentYearStr}-000000`;
  const managerUidPrefill = `MC-MGR-${currentYearStr}-000000`;

  const rememberedUid = localStorage.getItem(REMEMBER_UID_KEY);
  if (rememberedUid) {
    if (rememberedUid.startsWith('MC-STF-') || rememberedUid.startsWith('MUNCS')) {
      setRoleMode('STAFF', rememberedUid);
    } else {
      setRoleMode('MANAGER', rememberedUid);
    }
    if (rememberCheckbox) rememberCheckbox.checked = true;
    if (passwordInput) passwordInput.focus();
  } else {
    setRoleMode('MANAGER', MANAGER_UID);
  }

  // Role Tab Switching
  if (tabManager && tabStaff) {
    tabManager.addEventListener('click', () => setRoleMode('MANAGER'));
    tabStaff.addEventListener('click', () => setRoleMode('STAFF'));
  }

  function setRoleMode(role, specificUid = '') {
    currentRoleSelection = role;
    clearAllErrors();

    if (role === 'MANAGER') {
      tabManager.classList.add('active');
      tabStaff.classList.remove('active');
      roleIndicatorChip.className = 'role-badge-chip chip-manager';
      roleIndicatorText.textContent = 'Main Administration Portal (UID: MC-ADM-14012025)';
      labelUid.textContent = 'Main Administration / Manager User ID (UID)';
      uidIconDisplay.textContent = '👑';
      uidInput.value = specificUid || MANAGER_UID;
      uidInput.placeholder = 'MC-ADM-14012025';
      uidHelperText.innerHTML = `Master Admin UID: <strong>MC-ADM-14012025</strong> · Manager Prefix: <strong>${managerUidPrefill}</strong>`;
    } else {
      tabStaff.classList.add('active');
      tabManager.classList.remove('active');
      roleIndicatorChip.className = 'role-badge-chip chip-staff';
      roleIndicatorText.textContent = 'Front Desk & Service Operator Portal (Universal Global SL)';
      labelUid.textContent = 'Staff User ID (UID)';
      uidIconDisplay.textContent = '👤';
      uidInput.value = specificUid || staffUidPrefill;
      uidInput.placeholder = `${staffUidPrefill}01`;
      uidHelperText.innerHTML = `Staff UID Format: <strong>${staffUidPrefill}XX</strong> (8-Digit Global SL)`;
    }

    if (clearUserInputBtn) clearUserInputBtn.style.display = uidInput.value ? 'block' : 'none';
  }

  // Clear UID input button
  if (uidInput && clearUserInputBtn) {
    uidInput.addEventListener('input', () => {
      clearUserInputBtn.style.display = uidInput.value ? 'block' : 'none';
      hideFieldError('uid-error');
    });
    clearUserInputBtn.addEventListener('click', () => {
      uidInput.value = '';
      clearUserInputBtn.style.display = 'none';
      uidInput.focus();
    });
  }

  // Show / Hide Password Toggle
  if (togglePwdBtn && passwordInput) {
    togglePwdBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      togglePwdBtn.textContent = isPassword ? '🔒' : '👁️';
    });
  }

  // Login Form Submission
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAllErrors();

      const uid = (uidInput.value || '').trim().toUpperCase();
      const password = (passwordInput.value || '').trim();

      if (!uid) {
        showFieldError('uid-error', 'Please enter your assigned User ID (UID).');
        uidInput.classList.add('error');
        return;
      }

      if (!password) {
        showFieldError('password-error', 'Please enter your account password.');
        passwordInput.classList.add('error');
        return;
      }

      setLoadingState(true);

      // Remember UID
      if (rememberCheckbox && rememberCheckbox.checked) {
        localStorage.setItem(REMEMBER_UID_KEY, uid);
      } else {
        localStorage.removeItem(REMEMBER_UID_KEY);
      }

      try {
        const result = await authenticateAsync(uid, password);

        if (result.success) {
          const user = result.user;

          // Check if user is forced to change temporary password
          if (result.mustChangePassword) {
            setLoadingState(false);
            openPasswordChangeModal(user, password);
            return;
          }

          showAlert(`Authentication verified! Welcome back, ${user.name}. Redirecting...`, 'success');
          setTimeout(() => {
            window.location.href = '/index.html#dashboard';
          }, 400);
        } else {
          setLoadingState(false);
          showAlert(result.message || 'Invalid User ID or Password.', 'danger');
          passwordInput.classList.add('error');
          passwordInput.select();
        }
      } catch (err) {
        setLoadingState(false);
        showAlert('Network or server error during authentication. Please retry.', 'danger');
      }
    });
  }

  // Mandatory First-Time Password Change Modal Logic
  function openPasswordChangeModal(user, currentInputPass = '') {
    if (!pwdChangeModal) return;
    pwdChangeModal.classList.add('open');
    if (changeUserUid) changeUserUid.value = user.uid || user.id;
    if (changeUidDisplay) changeUidDisplay.value = `${user.uid || user.id} - ${user.name}`;
    if (changeCurrentPwd) changeCurrentPwd.value = currentInputPass;
    if (changeNewPwd) {
      changeNewPwd.value = '';
      changeNewPwd.focus();
    }
    if (changeConfirmPwd) changeConfirmPwd.value = '';
    if (pwdChangeAlert) {
      pwdChangeAlert.style.display = 'block';
      pwdChangeAlert.className = 'login-alert show warning';
      pwdChangeAlert.innerHTML = `<span>⚠</span><div>First login detected! Please replace your one-time temporary password with your own permanent secure password to activate dashboard access.</div>`;
    }
  }

  if (btnCancelPwdChange) {
    btnCancelPwdChange.addEventListener('click', () => {
      logout();
      pwdChangeModal.classList.remove('open');
      showAlert('Sign in cancelled. You must change your temporary password to enter the system.', 'warning');
    });
  }

  if (pwdChangeForm) {
    pwdChangeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const uid = (changeUserUid.value || '').trim();
      const currentPass = (changeCurrentPwd.value || '').trim();
      const newPass = (changeNewPwd.value || '').trim();
      const confirmPass = (changeConfirmPwd.value || '').trim();

      if (!newPass || !confirmPass) {
        showPwdAlert('Please fill in both new password fields.', 'danger');
        return;
      }

      if (newPass !== confirmPass) {
        showPwdAlert('New password and confirmation do not match.', 'danger');
        return;
      }

      if (newPass.length < 8) {
        showPwdAlert('New password must be at least 8 characters long.', 'danger');
        return;
      }

      if (newPass === currentPass) {
        showPwdAlert('New password cannot be the same as your temporary password. Choose a custom password.', 'danger');
        return;
      }

      const submitBtn = document.getElementById('btn-submit-pwd-change');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner"></span> <span>Saving Secure Password...</span>`;
      }

      const res = await changePasswordAsync(uid, currentPass, newPass, confirmPass);

      if (res.success) {
        showPwdAlert('Password updated successfully! Entering MUN COMPUTER ERP...', 'success');
        setTimeout(() => {
          pwdChangeModal.classList.remove('open');
          window.location.href = '/index.html#dashboard';
        }, 600);
      } else {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>Set New Password & Enter ERP</span>`;
        }
        showPwdAlert(res.message || 'Failed to update password.', 'danger');
      }
    });
  }

  function showPwdAlert(msg, type = 'danger') {
    if (!pwdChangeAlert) return;
    pwdChangeAlert.style.display = 'block';
    pwdChangeAlert.className = `login-alert show ${type}`;
    pwdChangeAlert.innerHTML = `<span>${type === 'success' ? '✓' : '⚠'}</span><div>${msg}</div>`;
  }

  // Staff Registration Modal Handlers
  if (btnOpenRegister && regModal) {
    btnOpenRegister.addEventListener('click', () => {
      regModal.classList.add('open');
      if (regAlert) regAlert.style.display = 'none';
      if (regName) regName.focus();
    });
  }

  if (btnCloseRegister && regModal) {
    btnCloseRegister.addEventListener('click', () => {
      regModal.classList.remove('open');
    });
  }

  // Send Registration OTP
  if (btnSendRegOtp) {
    btnSendRegOtp.addEventListener('click', async () => {
      const phone = (regPhone.value || '').replace(/[^0-9]/g, '');
      if (phone.length !== 10) {
        showRegAlert('Please enter a valid 10-digit mobile number.', 'danger');
        regPhone.focus();
        return;
      }

      btnSendRegOtp.disabled = true;
      btnSendRegOtp.innerHTML = `<span class="spinner"></span> <span>Sending...</span>`;

      try {
        const resp = await fetch('/api/auth/request-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, type: 'REGISTRATION' })
        });
        const data = await resp.json();

        if (resp.ok && data.success) {
          showRegAlert(data.message, 'success');
          if (regOtpSection) regOtpSection.style.display = 'block';
          if (regOtpInput) regOtpInput.focus();
          startRegCooldown(data.cooldownSeconds || 60);
        } else {
          showRegAlert(data.message || 'Failed to send OTP via SMS gateway.', 'danger');
          btnSendRegOtp.disabled = false;
          btnSendRegOtp.textContent = 'Send OTP';
        }
      } catch (err) {
        showRegAlert('SMS Gateway request failed. Check internet connection or contact administration.', 'danger');
        btnSendRegOtp.disabled = false;
        btnSendRegOtp.textContent = 'Send OTP';
      }
    });
  }

  // Verify Registration OTP
  if (btnVerifyRegOtp) {
    btnVerifyRegOtp.addEventListener('click', async () => {
      const phone = (regPhone.value || '').replace(/[^0-9]/g, '');
      const otp = (regOtpInput.value || '').trim();

      if (otp.length !== 6) {
        regOtpStatus.innerHTML = '<span style="color:var(--danger);">Please enter complete 6-digit OTP.</span>';
        return;
      }

      btnVerifyRegOtp.disabled = true;
      btnVerifyRegOtp.innerHTML = `<span class="spinner"></span>`;

      try {
        const resp = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, otp, type: 'REGISTRATION' })
        });
        const data = await resp.json();

        if (resp.ok && data.success) {
          regVerifiedToken = data.verifiedToken;
          regOtpStatus.innerHTML = '<span style="color:var(--success); font-weight:700;">✓ Mobile Verified Successfully!</span>';
          btnVerifyRegOtp.textContent = 'Verified ✓';
          btnVerifyRegOtp.style.background = 'var(--success)';
          btnSubmitRegister.disabled = false;
          showRegAlert('Mobile verified! Click "Complete Registration" below to finish.', 'success');
        } else {
          btnVerifyRegOtp.disabled = false;
          btnVerifyRegOtp.textContent = 'Verify';
          regOtpStatus.innerHTML = `<span style="color:var(--danger);">${data.message || 'Invalid OTP code.'}</span>`;
        }
      } catch (err) {
        btnVerifyRegOtp.disabled = false;
        btnVerifyRegOtp.textContent = 'Verify';
        regOtpStatus.innerHTML = '<span style="color:var(--danger);">Verification failed. Try again.</span>';
      }
    });
  }

  // Submit Registration
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = (regName.value || '').trim();
      const phone = (regPhone.value || '').replace(/[^0-9]/g, '');
      const designation = document.getElementById('reg-designation')?.value || 'Front Desk Operator';
      const address = document.getElementById('reg-address')?.value || '';

      if (!regVerifiedToken) {
        showRegAlert('Mobile OTP verification is required before completing registration.', 'danger');
        return;
      }

      btnSubmitRegister.disabled = true;
      btnSubmitRegister.innerHTML = `<span class="spinner"></span> <span>Registering...</span>`;

      try {
        const resp = await fetch('/api/auth/register-staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName,
            phone,
            designation,
            address,
            verifiedToken: regVerifiedToken
          })
        });
        const data = await resp.json();

        if (resp.ok && data.success) {
          regForm.innerHTML = `
            <div style="text-align:center; padding:1.5rem 0;">
              <div style="width:56px; height:56px; border-radius:50%; background:var(--success-bg); color:var(--success); display:inline-flex; align-items:center; justify-content:center; font-size:1.8rem; margin-bottom:1rem;">✓</div>
              <h4 style="font-size:1.2rem; font-weight:800; color:#0f172a; margin-bottom:0.5rem;">Registration Submitted!</h4>
              <div style="background:#f1f5f9; padding:1rem; border-radius:8px; margin:1rem 0; border:1px solid #cbd5e1;">
                <div style="font-size:0.8rem; color:var(--text-muted);">Assigned Staff User ID:</div>
                <div style="font-size:1.4rem; font-weight:800; color:var(--royal-blue); margin:0.25rem 0;">${data.staffUid}</div>
                <div style="font-size:0.78rem; color:var(--text-secondary);">Temporary Initial Password: <strong>${data.temporaryPassword}</strong></div>
              </div>
              <div style="font-size:0.83rem; color:var(--text-muted); line-height:1.5; margin-bottom:1.5rem;">
                Your account is currently <strong>PENDING APPROVAL</strong> by Administration. Once activated, sign in using your Staff UID and temporary password (<strong>${data.temporaryPassword}</strong>), and you will be prompted to set your own password.
              </div>
              <button type="button" class="btn-submit-login" style="width:100%;" onclick="window.location.reload()">
                Return to Login Page
              </button>
            </div>
          `;
        } else {
          btnSubmitRegister.disabled = false;
          btnSubmitRegister.textContent = 'Complete Registration';
          showRegAlert(data.message || 'Registration failed.', 'danger');
        }
      } catch (err) {
        btnSubmitRegister.disabled = false;
        btnSubmitRegister.textContent = 'Complete Registration';
        showRegAlert('Server connection error. Please try again.', 'danger');
      }
    });
  }

  function startRegCooldown(seconds) {
    let remaining = seconds;
    if (regOtpTimer) regOtpTimer.style.display = 'flex';
    if (btnResendRegOtp) btnResendRegOtp.disabled = true;

    clearInterval(regCooldownTimer);
    regCooldownTimer = setInterval(() => {
      remaining -= 1;
      if (regTimerCountdown) regTimerCountdown.textContent = `Resend available in ${remaining}s`;
      if (remaining <= 0) {
        clearInterval(regCooldownTimer);
        if (regTimerCountdown) regTimerCountdown.textContent = '';
        if (btnResendRegOtp) btnResendRegOtp.disabled = false;
        if (btnSendRegOtp) {
          btnSendRegOtp.disabled = false;
          btnSendRegOtp.textContent = 'Send OTP';
        }
      }
    }, 1000);
  }

  function showRegAlert(msg, type = 'danger') {
    if (!regAlert) return;
    regAlert.style.display = 'block';
    regAlert.className = `login-alert show ${type}`;
    regAlert.innerHTML = `<span>${type === 'success' ? '✓' : '⚠'}</span><div>${msg}</div>`;
  }

  // Forgot Password Modal Handlers
  if (linkForgotPwd && recoveryModal) {
    linkForgotPwd.addEventListener('click', (e) => {
      e.preventDefault();
      recoveryModal.classList.add('open');
      if (recoveryAlert) recoveryAlert.style.display = 'none';
      if (recoveryIdentity) recoveryIdentity.focus();
    });
  }

  if (btnCloseRecovery && recoveryModal) {
    btnCloseRecovery.addEventListener('click', () => {
      recoveryModal.classList.remove('open');
    });
  }

  // Step 1: Send OTP for Forgot Password
  if (recoveryFormStep1) {
    recoveryFormStep1.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ident = (recoveryIdentity.value || '').trim();
      const btnStep1 = document.getElementById('btn-submit-recovery-step1');

      if (!ident) return;

      if (btnStep1) {
        btnStep1.disabled = true;
        btnStep1.innerHTML = `<span class="spinner"></span> <span>Dispatching OTP...</span>`;
      }

      const isPhone = /^[0-9]{10}$/.test(ident.replace(/[^0-9]/g, ''));
      const phoneParam = isPhone ? ident.replace(/[^0-9]/g, '') : '';
      const uidParam = !isPhone ? ident.toUpperCase() : '';

      try {
        const resp = await fetch('/api/auth/request-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: phoneParam || '8101352105',
            uid: uidParam,
            type: 'FORGOT_PASSWORD'
          })
        });
        const data = await resp.json();

        if (btnStep1) {
          btnStep1.disabled = false;
          btnStep1.textContent = 'Send Verification OTP';
        }

        if (recoveryAlert) {
          recoveryAlert.style.display = 'block';
          recoveryAlert.className = 'login-alert show success';
          recoveryAlert.innerHTML = `<span>✓</span><div>${data.message || 'If an authorized account is linked, an OTP has been dispatched.'}</div>`;
        }

        // Show Step 2
        recoveryFormStep1.style.display = 'none';
        recoveryFormStep2.style.display = 'block';
        if (recVerifiedPhone) recVerifiedPhone.value = phoneParam || '8101352105';
        if (recOtpInput) recOtpInput.focus();
      } catch (err) {
        if (btnStep1) {
          btnStep1.disabled = false;
          btnStep1.textContent = 'Send Verification OTP';
        }
        if (recoveryAlert) {
          recoveryAlert.style.display = 'block';
          recoveryAlert.className = 'login-alert show danger';
          recoveryAlert.innerHTML = `<span>⚠</span><div>Unable to reach SMS gateway. Contact MUN COMPUTER administration (8101352105).</div>`;
        }
      }
    });
  }

  // Step 2: Verify OTP
  if (btnVerifyRecOtp) {
    btnVerifyRecOtp.addEventListener('click', async () => {
      const phone = recVerifiedPhone.value;
      const otp = (recOtpInput.value || '').trim();

      if (otp.length !== 6) {
        recOtpStatus.innerHTML = '<span style="color:var(--danger);">Please enter 6-digit OTP.</span>';
        return;
      }

      btnVerifyRecOtp.disabled = true;
      btnVerifyRecOtp.innerHTML = `<span class="spinner"></span>`;

      try {
        const resp = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, otp, type: 'FORGOT_PASSWORD' })
        });
        const data = await resp.json();

        if (resp.ok && data.success) {
          recVerifiedToken.value = data.verifiedToken;
          recOtpStatus.innerHTML = '<span style="color:var(--success); font-weight:700;">✓ OTP Verified! Set your new password below.</span>';
          btnVerifyRecOtp.textContent = 'Verified ✓';
          btnVerifyRecOtp.style.background = 'var(--success)';
          if (recPasswordFields) recPasswordFields.style.display = 'block';
          if (recNewPwd) recNewPwd.focus();
        } else {
          btnVerifyRecOtp.disabled = false;
          btnVerifyRecOtp.textContent = 'Verify OTP';
          recOtpStatus.innerHTML = `<span style="color:var(--danger);">${data.message || 'Invalid OTP code.'}</span>`;
        }
      } catch (err) {
        btnVerifyRecOtp.disabled = false;
        btnVerifyRecOtp.textContent = 'Verify OTP';
        recOtpStatus.innerHTML = '<span style="color:var(--danger);">Verification failed. Try again.</span>';
      }
    });
  }

  // Final Step: Reset Password
  if (recoveryFormStep2) {
    recoveryFormStep2.addEventListener('submit', async (e) => {
      e.preventDefault();
      const phone = recVerifiedPhone.value;
      const token = recVerifiedToken.value;
      const newPassword = (recNewPwd.value || '').trim();
      const confirmPassword = (recConfirmPwd.value || '').trim();

      if (!token) {
        if (recoveryAlert) {
          recoveryAlert.className = 'login-alert show danger';
          recoveryAlert.innerHTML = `<span>⚠</span><div>Please verify OTP code before resetting password.</div>`;
        }
        return;
      }

      if (newPassword !== confirmPassword) {
        if (recoveryAlert) {
          recoveryAlert.className = 'login-alert show danger';
          recoveryAlert.innerHTML = `<span>⚠</span><div>New password and confirmation do not match.</div>`;
        }
        return;
      }

      if (newPassword.length < 6) {
        if (recoveryAlert) {
          recoveryAlert.className = 'login-alert show danger';
          recoveryAlert.innerHTML = `<span>⚠</span><div>Password must be at least 6 characters long.</div>`;
        }
        return;
      }

      const btnReset = document.getElementById('btn-submit-reset-final');
      if (btnReset) {
        btnReset.disabled = true;
        btnReset.innerHTML = `<span class="spinner"></span> <span>Resetting...</span>`;
      }

      try {
        const resp = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone,
            verifiedToken: token,
            newPassword,
            confirmPassword
          })
        });
        const data = await resp.json();

        if (resp.ok && data.success) {
          recoveryModal.classList.remove('open');
          showAlert(data.message || 'Password reset successfully! Please sign in with your new password.', 'success');
          if (uidInput && data.uid) uidInput.value = data.uid;
          if (passwordInput) {
            passwordInput.value = '';
            passwordInput.focus();
          }
        } else {
          if (btnReset) {
            btnReset.disabled = false;
            btnReset.textContent = 'Reset Password & Log In';
          }
          if (recoveryAlert) {
            recoveryAlert.className = 'login-alert show danger';
            recoveryAlert.innerHTML = `<span>⚠</span><div>${data.message || 'Password reset failed.'}</div>`;
          }
        }
      } catch (err) {
        if (btnReset) {
          btnReset.disabled = false;
          btnReset.textContent = 'Reset Password & Log In';
        }
        if (recoveryAlert) {
          recoveryAlert.className = 'login-alert show danger';
          recoveryAlert.innerHTML = `<span>⚠</span><div>Network error during password reset.</div>`;
        }
      }
    });
  }

  // Active Session Banner
  function checkActiveSession() {
    const active = getCurrentUser();
    const banner = document.getElementById('active-session-banner');
    const userText = document.getElementById('active-user-name');
    const roleText = document.getElementById('active-user-role');
    const logoutBtn = document.getElementById('btn-active-logout');

    if (active && !active.isLoggedOut && banner) {
      banner.style.display = 'block';
      if (userText) userText.textContent = active.name;
      if (roleText) roleText.textContent = `(${active.uid || active.id} - ${active.role})`;
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          logout();
          banner.style.display = 'none';
          showAlert('Signed out of MUN COMPUTER ERP.', 'warning');
        });
      }
    }
  }

  // UI Helpers
  function setLoadingState(isLoading) {
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    if (isLoading) {
      submitBtn.innerHTML = `<span class="spinner"></span> <span>VERIFYING CREDENTIALS...</span>`;
    } else {
      submitBtn.innerHTML = `<span>SIGN IN TO DASHBOARD</span> <span>→</span>`;
    }
  }

  function showAlert(msg, type = 'danger') {
    if (!alertBox) return;
    alertBox.className = `login-alert show ${type}`;
    alertBox.innerHTML = `
      <span style="font-size:1.1rem; line-height:1;">${type === 'success' ? '✓' : type === 'warning' ? '⏰' : '⚠'}</span>
      <div>${msg}</div>
    `;
  }

  function showFieldError(elemId, message) {
    const errorElem = document.getElementById(elemId);
    if (errorElem) {
      errorElem.textContent = message;
      errorElem.classList.add('show');
    }
  }

  function clearAllErrors() {
    if (alertBox) alertBox.className = 'login-alert';
    document.querySelectorAll('.login-input').forEach(i => i.classList.remove('error'));
    document.querySelectorAll('.field-error-text').forEach(e => e.classList.remove('show'));
  }

  function hideFieldError(elemId) {
    const errorElem = document.getElementById(elemId);
    if (errorElem) errorElem.classList.remove('show');
  }
}
