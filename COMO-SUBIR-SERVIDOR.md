# Como subir o servidor (porta 8082)

O servidor **precisa rodar no seu terminal** e ficar aberto. Se fechar o terminal, o servidor para.

## No Terminal (Cursor ou Mac)

1. Abra o **Terminal** (no Cursor: Terminal → New Terminal, ou o app Terminal do Mac).
2. Vá até a pasta do projeto:
   ```bash
   cd "/Users/sarahsantiago/Desktop/SDK lite 1.5"
   ```
3. Inicie o servidor:
   ```bash
   node server.js
   ```
   Ou use:
   ```bash
   npm start
   ```
   Ou:
   ```bash
   ./run
   ```
4. Deixe essa janela do terminal **aberta**. Quando aparecer:
   ```text
   Server is running at: http://localhost:8082
   ```
   abra no navegador: **http://localhost:8082**

5. Para parar o servidor: no terminal, pressione **Ctrl+C**.

---

Se ainda não abrir no navegador, tente: **http://127.0.0.1:8082**
