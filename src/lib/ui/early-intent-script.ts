import { EARLY_INTENT_ATTRIBUTE, EARLY_INTENT_GLOBAL } from './early-intent';

/**
 * The inline script that keeps a tap made before the page is interactive (AQP-188 AC-10, DEF-013). React cannot see
 * a tap made before its bundle has run, so only a script already in the HTML can. It is imported by the server
 * layout only, so its text is never part of the browser's JavaScript, and an inline script has no `src`, so it does not
 * count against the budget (test strategy 10.1). It carries the CSP nonce once the CSP is built (architecture section 10).
 *
 * What it does, and nothing else:
 *   - A click (a tap, a mouse click, Enter or Space on a button) on an element marked `data-early-intent` marks that
 *     element `aria-busy="true"` (the pending look is styled on that attribute, UX spec 7.3.1 rule 11) and records which
 *     control it was. The last control pressed wins. A second press of the same control does nothing.
 *   - Escape removes the mark and the record: the open is cancelled.
 *   - It reads no user data and sends no request.
 * The first-open hook reads the record at hydration (`readEarlyIntent`), then `finishEarlyIntent` calls `stop`: the
 * script's listeners are removed and the record is deleted, so React is the only owner of the attribute from then on.
 *
 * It is plain ES5 text, not compiled code, and `tests/unit/early-intent.test.ts` runs it against a stand-in document.
 */
export const EARLY_INTENT_SCRIPT = `(function(){
var A=${JSON.stringify(EARLY_INTENT_ATTRIBUTE)},d=document,r={id:null,keyboard:false,stop:stop};
function find(id){return id===null?null:d.querySelector('['+A+'="'+id+'"]')}
function clear(){var e=find(r.id);if(e)e.removeAttribute('aria-busy');r.id=null;r.keyboard=false}
function onClick(v){var t=v.target,e=t&&t.closest?t.closest('['+A+']'):null;if(!e)return;var id=e.getAttribute(A);if(id===r.id)return;clear();r.id=id;r.keyboard=v.detail===0;e.setAttribute('aria-busy','true')}
function onKey(v){if(v.key==='Escape')clear()}
function stop(){d.removeEventListener('click',onClick,true);d.removeEventListener('keydown',onKey,true)}
d.addEventListener('click',onClick,true);d.addEventListener('keydown',onKey,true);
window[${JSON.stringify(EARLY_INTENT_GLOBAL)}]=r;
})();`;
