<script type="module">
        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
        import { getFirestore, collection, addDoc, serverTimestamp, enableIndexedDbPersistence, onSnapshot } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js"; // Nota: ho aggiunto onSnapshot qui

        const firebaseConfig = {
            apiKey: "AIzaSyAACj8J2iOSAwS_DJaJQGvwB8-klMZ_NgE",
            authDomain: "hccp-nvs.firebaseapp.com",
            projectId: "hccp-nvs",
            storageBucket: "hccp-nvs.firebasestorage.app",
            messagingSenderId: "426557690382",
            appId: "1:426557690382:web:9c45087394117f8953a25f"
        };
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);

        enableIndexedDbPersistence(db).catch(err => console.warn("Offline fallback fallito", err));
        window.addEventListener('offline', () => document.getElementById('offline-badge').style.display = 'block');
        window.addEventListener('online', () => document.getElementById('offline-badge').style.display = 'none');

        // GESTIONE STATO APP
        window.activeOp = null;
        window.currentTarget = null; 
        let currentPin = "";
        
        // --- NUOVA LOGICA: Scarica gli operatori da Firebase in tempo reale ---
        let dbOperatori = {}; // Oggetto vuoto che si riempirà dal Cloud
        
        onSnapshot(collection(db, "operatori"), (snapshot) => {
            dbOperatori = {}; // Svuota l'oggetto locale
            snapshot.forEach((doc) => {
                const op = doc.data();
                // Usa il PIN come chiave per una ricerca veloce durante il login
                dbOperatori[op.pin] = `${op.nome} (${op.qualifica})`; 
            });
            console.log("Anagrafica Operatori aggiornata dal Cloud.");
        });
        // ----------------------------------------------------------------------

        window.getToday = () => { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; };
        
        window.showToast = (msg) => {
            const t = document.getElementById('toast');
            t.innerText = msg; t.classList.add('show');
            setTimeout(() => t.classList.remove('show'), 3000);
        };

        window.onload = () => {
            document.getElementById('tempData').value = window.getToday();
            document.getElementById('areeData').value = window.getToday();
            document.getElementById('pulizieData').value = window.getToday();
        };

        // LOGICA LOGIN E PIN
        window.addPin = (num) => { if(currentPin.length < 4) { currentPin += num; document.getElementById('pin-display').innerText = '•'.repeat(currentPin.length); }};
        window.clearPin = () => { currentPin = ""; document.getElementById('pin-display').innerText = ""; };
        window.checkPin = () => {
            // Controlla se il PIN digitato esiste nell'oggetto scaricato da Firebase
            if (dbOperatori[currentPin]) {
                window.activeOp = dbOperatori[currentPin]; // Salva il nome + qualifica
                document.getElementById('mainHeader').innerText = `O.S.A: ${window.activeOp}`;
                window.switchView('menu');
                currentPin = ""; document.getElementById('pin-display').innerText = "";
            } else { 
                window.showToast("❌ PIN Errato o Utente non trovato"); 
                window.clearPin(); 
            }
        };

        window.logout = () => { window.activeOp = null; window.switchView('login'); };

        window.switchView = (viewId) => {
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById('view-' + viewId).classList.add('active');
            
            if(viewId === 'login') document.getElementById('mainHeader').innerText = `NVS - Accesso Operatore`;
            
            document.getElementById('tempData').value = window.getToday();
            document.getElementById('areeData').value = window.getToday();
            document.getElementById('pulizieData').value = window.getToday();
        };

        document.querySelectorAll('.check-grid input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', function() {
                if (this.checked) this.parentElement.classList.add('active');
                else this.parentElement.classList.remove('active');
            });
        });

        window.selectAllTasks = () => {
            document.querySelectorAll('#grid-pulizie .check-item').forEach(item => {
                let cb = item.querySelector('input');
                cb.checked = true; item.classList.add('active');
            });
        };

        window.checkTemp = () => {
            const f1 = parseFloat(document.getElementById('tAD').value); const f2 = parseFloat(document.getElementById('tAS').value);
            const f3 = parseFloat(document.getElementById('tCS').value); const f4 = document.getElementById('tCC').value;
            let err = ((f1&&f1>4)||(f2&&f2>4)||(f3&&f3>-18)||(f4&&f4>-18));
            document.getElementById('tempAlert').style.display = err ? 'block' : 'none';
        };

        window.autoFillTemp = () => {
            document.getElementById('tAD').value = "3.5"; document.getElementById('tAS').value = "3.2";
            document.getElementById('tCS').value = "-19.0"; document.getElementById('tCC').value = "-19.5";
            window.checkTemp();
        };

        const canvas = document.getElementById('signatureCanvas');
        let ctx = canvas.getContext('2d');
        window.isDrawing = false;

        const resizeCanvas = () => {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio; canvas.height = canvas.offsetHeight * ratio;
            ctx.scale(ratio, ratio); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#0f172a';
        };

        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return { x: clientX - rect.left, y: clientY - rect.top };
        };

        const startDraw = (e) => { window.isDrawing = true; window.draw(e); };
        const endDraw = () => { window.isDrawing = false; ctx.beginPath(); };
        window.draw = (e) => {
            if (!window.isDrawing) return; e.preventDefault();
            const pos = getPos(e); ctx.lineTo(pos.x, pos.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
        };

        canvas.addEventListener('mousedown', startDraw); canvas.addEventListener('mouseup', endDraw); canvas.addEventListener('mousemove', window.draw);
        canvas.addEventListener('touchstart', startDraw, {passive:false}); canvas.addEventListener('touchend', endDraw); canvas.addEventListener('touchmove', window.draw, {passive:false});

        window.requestSignature = (target) => {
            if(target === 'temp') {
                const f1 = document.getElementById('tAD').value; const f2 = document.getElementById('tAS').value; 
                const f3 = document.getElementById('tCS').value; const f4 = document.getElementById('tCC').value;
                if(!f1 && !f2 && !f3 && !f4) return window.showToast("Inserisci almeno una temperatura!");
                if(document.getElementById('tempAlert').style.display === 'block' && !document.getElementById('tAction').value.trim()) return window.showToast("Manca Azione Correttiva!");
            }
            if(target === 'aree') {
                if(document.querySelectorAll('#grid-aree input:checked').length === 0) return window.showToast("Spunta almeno un'area!");
            }
            if(target === 'pulizie') {
                if(document.querySelectorAll('#grid-pulizie input:checked').length === 0) return window.showToast("Spunta almeno un'operazione!");
            }

            window.currentTarget = target;
            document.getElementById('signatureModal').style.display = 'flex';
            setTimeout(resizeCanvas, 100); 
        };

        window.closeSignature = () => { document.getElementById('signatureModal').style.display = 'none'; window.currentTarget = null; };
        window.clearSignature = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.beginPath(); };

        const isCanvasBlank = () => {
            const blank = document.createElement('canvas');
            blank.width = canvas.width; blank.height = canvas.height;
            return canvas.toDataURL() === blank.toDataURL();
        };

        window.confirmSignature = async () => {
            if(isCanvasBlank()) return window.showToast("Devi firmare all'interno del riquadro!");
            const sigBase64 = canvas.toDataURL('image/png');
            window.closeSignature();
            
            let data_dichiarata = "";
            let pulizie = [];
            let temperature = { t_frigo_doppia: "", t_frigo_singola: "", t_cong_singola: "", t_cong_colonna: "" };
            let note = "";

            if(window.currentTarget === 'temp') {
                data_dichiarata = document.getElementById('tempData').value;
                temperature = {
                    t_frigo_doppia: document.getElementById('tAD').value,
                    t_frigo_singola: document.getElementById('tAS').value,
                    t_cong_singola: document.getElementById('tCS').value,
                    t_cong_colonna: document.getElementById('tCC').value
                };
                note = document.getElementById('tAction').value.trim();
            } else if (window.currentTarget === 'aree') {
                data_dichiarata = document.getElementById('areeData').value;
                document.querySelectorAll('#grid-aree input:checked').forEach(cb => pulizie.push(`S. Area: ${cb.value}`));
                note = document.getElementById('areeNote').value.trim();
            } else if (window.currentTarget === 'pulizie') {
                data_dichiarata = document.getElementById('pulizieData').value;
                document.querySelectorAll('#grid-pulizie input:checked').forEach(cb => pulizie.push(cb.value));
                note = document.getElementById('pulizieNote').value.trim();
            }

            const payload = {
                data_dichiarata: data_dichiarata,
                timestamp_server: serverTimestamp(), 
                operatore: window.activeOp, // Invia al DB il nome preso dall'anagrafica Cloud
                temperature: temperature,
                pulizie_eseguite: pulizie.length > 0 ? pulizie : null,
                prodotti_certificati: pulizie.length > 0 ? "Cloro/Alcolica" : null,
                note: note,
                firma_base64: sigBase64
            };
            
            try {
                await addDoc(collection(db, "haccp_registri"), payload);
                window.showToast("✅ Registrazione Salvata!");
                
                if(window.currentTarget === 'temp') {
                    ['tAD','tAS','tCS','tCC','tAction'].forEach(id => document.getElementById(id).value='');
                    window.checkTemp();
                } else if (window.currentTarget === 'aree') {
                    document.querySelectorAll('#grid-aree .check-item').forEach(item => { item.classList.remove('active'); item.querySelector('input').checked = false; });
                    document.getElementById('areeNote').value = '';
                } else if (window.currentTarget === 'pulizie') {
                    document.querySelectorAll('#grid-pulizie .check-item').forEach(item => { item.classList.remove('active'); item.querySelector('input').checked = false; });
                    document.getElementById('pulizieNote').value = '';
                }
                
                window.switchView('menu');
            } catch(e) {
                console.error(e); 
                window.showToast("Errore durante il salvataggio.");
            }
        };
    </script>