/**
 * RENEW OS - Security Guard
 * Deterrent system against unauthorized data copying and screenshots.
 * Note: Real screenshot blocking is only possible at OS level in native apps (Capacitor/Cordova).
 */

(function() {
    // 1. Disable Right Click (TEMPORARILY DISABLED)
    // document.addEventListener('contextmenu', e => e.preventDefault());
 
    // 2. Disable Keyboard Shortcuts (Copy, Print, Save, DevTools) (TEMPORARILY DISABLED)
    /*
    document.addEventListener('keydown', e => {
        // Block Ctrl+C (Copy), Ctrl+U (Source), Ctrl+S (Save), Ctrl+P (Print)
        if (e.ctrlKey && (e.key === 'c' || e.key === 'u' || e.key === 's' || e.key === 'p')) {
            e.preventDefault();
            return false;
        }
 
        // Block F12 and Ctrl+Shift+I (DevTools)
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
            e.preventDefault();
            return false;
        }
 
        // Block PrintScreen
        if (e.key === 'PrintScreen') {
            navigator.clipboard.writeText(''); // Clear clipboard immediately
            alert('Captura de pantalla no permitida por políticas de seguridad.');
            e.preventDefault();
        }
    });
    */

    // 3. Blur content when focus is lost (Deterrent for task switchers)
    // DISABLED: Causes the entire parent body to blur when interacting with iframes (e.g. Contract Module).
    // window.addEventListener('blur', () => {
    //     document.body.style.filter = 'blur(15px)';
    //     document.body.style.transition = 'filter 0.3s ease';
    // });
    //
    // window.addEventListener('focus', () => {
    //     document.body.style.filter = 'none';
    // });

    // 4. Inject CSS to block text selection and printing
    const style = document.createElement('style');
    style.innerHTML = `
        /* Prevent text selection (TEMPORARILY DISABLED) */
        /*
        * {
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
        }
        */

        /* Allow inputs to be selectable so users can type */
        input, textarea {
            -webkit-user-select: text !important;
            -moz-user-select: text !important;
            -ms-user-select: text !important;
            user-select: text !important;
        }

        /* Anti-Print Overlay */
        @media print {
            body { display: none !important; }
        }

        /* Visual Feedback for attempted screenshots (CSS trick) */
        .screenshot-deterrent {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #000;
            z-index: 999999;
            display: none;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-family: sans-serif;
            font-weight: bold;
        }
    `;
    document.head.appendChild(style);

    console.log('<i class="fa-solid fa-shield"></i>️ RENEW Security Guard Active');
})();
