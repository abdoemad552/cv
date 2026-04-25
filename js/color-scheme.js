$(function () {

    const PRESETS = [
        { color: '#0e7490', name: 'Cyan'   },
        { color: '#1d4ed8', name: 'Blue'   },
        { color: '#7c3aed', name: 'Violet' },
        { color: '#be185d', name: 'Pink'   },
        { color: '#b45309', name: 'Amber'  },
        { color: '#15803d', name: 'Green'  },
        { color: '#374151', name: 'Slate'  },
    ];

    const DEFAULT_COLOR  = '#0e7490';
    const WCAG_AA_NORMAL = 4.5;   // minimum for normal text
    const WCAG_AA_LARGE  = 3.0;   // minimum for large/bold text (headings)

    let toastTimer = null;

    /* ── WCAG contrast helpers ── */

    function hexToRgb(hex) {
        const n = parseInt(hex.slice(1), 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }

    // Relative luminance per WCAG 2.1
    function luminance(hex) {
        const { r, g, b } = hexToRgb(hex);
        const lin = (c) => {
            const s = c / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    }

    // Contrast ratio between two hex colours
    function contrastRatio(hex1, hex2) {
        const l1 = luminance(hex1);
        const l2 = luminance(hex2);
        const lighter = Math.max(l1, l2);
        const darker  = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
    }

    function lighten(hex, amount) {
        const { r, g, b } = hexToRgb(hex);
        const mix = (c) => Math.round(c + (255 - c) * amount);
        return `#${[mix(r), mix(g), mix(b)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
    }

    function currentColor() {
        return $('#color-picker').val() || DEFAULT_COLOR;
    }

    /* ── Contrast check & toast ── */

    function checkContrast(hex) {
        const bgColor    = '#ffffff';                   // CV background
        const ratio      = contrastRatio(hex, bgColor);
        const ratioFixed = ratio.toFixed(2);

        if (ratio < WCAG_AA_LARGE) {
            showToast(
                'error',
                `Poor contrast (${ratioFixed}:1)`,
                'This color is very hard to read. WCAG requires at least 3:1 for headings and 4.5:1 for body text.'
            );
        } else if (ratio < WCAG_AA_NORMAL) {
            showToast(
                'warning',
                `Low contrast (${ratioFixed}:1)`,
                'Acceptable for large headings, but may be hard to read at smaller sizes. WCAG AA requires 4.5:1 for normal text.'
            );
        } else {
            hideToast();
        }
    }

    /* ── Toast UI ── */

    function showToast(level, title, message) {
        clearTimeout(toastTimer);

        const icons = {
            warning : '⚠️',
            error   : '🚫',
        };

        $('#cv-toast')
            .attr('data-level', level)
            .find('.toast-icon').text(icons[level]).end()
            .find('.toast-title').text(title).end()
            .find('.toast-msg').text(message).end()
            .addClass('visible');

        // Auto-dismiss warnings after 6 s; errors stay until color changes
        if (level === 'warning') {
            toastTimer = setTimeout(hideToast, 6000);
        }
    }

    function hideToast() {
        clearTimeout(toastTimer);
        $('#cv-toast').removeClass('visible');
    }

    /* ── Dynamic print style injection ── */

    function updatePrintStyles(hex) {
        let $printStyle = $('#cv-print-color');
        if (!$printStyle.length) {
            $printStyle = $('<style id="cv-print-color">').appendTo('head');
        }
        $printStyle.text(`
            @media print {
                .text-cyan-600, .text-cyan-700 { color: ${hex} !important; }
                .border-cyan-600, .border-cyan-700 { border-color: ${hex} !important; }
                [data-cv~="text"]         { color: ${hex} !important; }
                [data-cv~="border"]       { border-color: ${hex} !important; }
                [data-cv~="bg"]           { background-color: ${hex} !important; }
                [data-cv~="bg-light"]     { background-color: ${lighten(hex, 0.88)} !important; }
                [data-cv~="border-light"] { border-color: ${lighten(hex, 0.65)} !important; }
            }
        `);
    }

    /* ── Apply color to all tagged elements ── */

    function applyColor(hex) {
        document.documentElement.style.setProperty('--cv-color', hex);
        $('#color-picker').val(hex);

        $('[data-cv]').each(function () {
            const $el  = $(this);
            const roles = $el.attr('data-cv').split(' ');

            roles.forEach(role => {
                if (role === 'text')         $el.css('color', hex);
                if (role === 'border')       $el.css('border-color', hex);
                if (role === 'bg')           $el.css('background-color', hex);
                if (role === 'bg-light')     $el.css('background-color', lighten(hex, 0.88));
                if (role === 'border-light') $el.css('border-color', lighten(hex, 0.65));
            });
        });

        updatePrintStyles(hex);
        checkContrast(hex);
        localStorage.setItem('cv-color', hex);

        $('.preset-dot').each(function () {
            $(this).toggleClass('active', $(this).attr('data-color').toLowerCase() === hex.toLowerCase());
        });
    }

    /* ── Tag elements by role ── */

    function addRole($el, role) {
        const existing = $el.attr('data-cv');
        if (!existing) {
            $el.attr('data-cv', role);
        } else if (!existing.split(' ').includes(role)) {
            $el.attr('data-cv', existing + ' ' + role);
        }
    }

    function tagElements() {
        $('h2.text-cyan-700, h2.border-cyan-700, .text-sm.font-bold.uppercase.border-b').each(function () {
            $(this).attr('data-cv', 'text border');
        });
        $('h1.text-cyan-700, p.text-cyan-700').each(function () {
            addRole($(this), 'text');
        });
        $('button.bg-cyan-700').each(function () {
            addRole($(this), 'bg');
        }).on('mouseenter', function () {
            $(this).css('filter', 'brightness(0.85)');
        }).on('mouseleave', function () {
            $(this).css('filter', '');
        });
        $('.bg-cyan-50').each(function () {
            addRole($(this), 'bg-light');
        });
        $('.border-cyan-200').each(function () {
            addRole($(this), 'border-light');
        });
        $('.text-cyan-700, svg.text-cyan-700').each(function () {
            addRole($(this), 'text');
        });
        $('a.hover\\:text-cyan-700').on('mouseenter', function () {
            $(this).css('color', currentColor());
        }).on('mouseleave', function () {
            $(this).css('color', '');
        });
    }

    /* ── Build toolbar ── */

    // Inject toast element into DOM
    $('body').append(`
        <div id="cv-toast">
            <span class="toast-icon"></span>
            <div class="toast-body">
                <strong class="toast-title"></strong>
                <span class="toast-msg"></span>
            </div>
            <button class="toast-close" title="Dismiss">✕</button>
        </div>
    `);

    $('#cv-toast').on('click', '.toast-close', hideToast);

    // Preset dots
    PRESETS.forEach(({ color, name }) => {
        $('<div>', {
            class: 'preset-dot',
            title: name,
            'data-color': color,
            css: { 'background-color': color },
            click: () => applyColor(color),
        }).appendTo('#presets');
    });

    $('#color-picker').on('input', function () {
        applyColor($(this).val());
    });

    /* ── Init ── */

    tagElements();
    applyColor(localStorage.getItem('cv-color') || DEFAULT_COLOR);

});