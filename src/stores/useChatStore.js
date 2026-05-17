/**
 * stores/useChatStore.js — Estado del chat con IA (Pinia).
 *
 * Gestiona historial de mensajes, memoria conversacional y sendChat.
 * Cada mensaje puede tener un campo `context` para el componente colapsable.
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { marked } from 'marked';
import { api } from '../api.js';

const MAX_MEMORY = 10;

export const useChatStore = defineStore('chat', () => {
    // ─── Estado ───────────────────────────────────────────────────────────────
    const chat = ref([
        {
            role: 'bot',
            text: 'Hola. Soy el **Analista IA** de cartera BNB. Puedo ayudarte a explorar KPIs, interpretar brechas, comparar contra el sistema financiero y revisar el desempeño comercial.\n\n¿Qué quieres analizar?'
        }
    ]);
    const chatInput = ref('');
    const chatLoading = ref(false);
    const useMcp = ref(false);
    const chatMemory = ref([]);

    // ─── Memoria ──────────────────────────────────────────────────────────────
    function compactPrompt(text, max = 2500) {
        const clean = String(text || '').replace(/\s+/g, ' ').trim();
        return clean.length <= max ? clean : `${clean.slice(0, max)}...`;
    }

    function addToMemory(role, text) {
        chatMemory.value.push({ role, text: compactPrompt(text) });
        if (chatMemory.value.length > MAX_MEMORY) {
            chatMemory.value = chatMemory.value.slice(-MAX_MEMORY);
        }
    }

    function buildMemoryText() {
        if (!chatMemory.value.length) return 'No existe contexto conversacional previo.';
        return chatMemory.value
            .map((m, i) => `${i + 1}. ${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${compactPrompt(m.text, 1200)}`)
            .join('\n');
    }

    // ─── Builders de mensaje ──────────────────────────────────────────────────
    function buildNormalMessage(text) {
        return `
Contexto conversacional previo:
${buildMemoryText()}

Consulta actual: ${text}

Modo: chat normal. Responde conversacionalmente sin invocar herramientas.
`.trim();
    }

    function buildMcpMessage(text) {
        return `
Contexto conversacional previo:
${buildMemoryText()}

Consulta actual: ${text}

Modo MCP activado. Puedes usar herramientas cuando sea necesario.
`.trim();
    }

    // ─── Acción principal ─────────────────────────────────────────────────────
    /**
     * sendChat — envía un mensaje al agente.
     * @param {string} message - Texto a enviar.
     * @param {object} [contextMeta] - Metadata del contexto para mostrar en el chat.
     *   { title: string, sections: string[], promptText: string }
     */
    async function sendChat(message = chatInput.value, contextMeta = null) {
        const text = String(message || '').trim();
        if (!text) return;

        // Si es un análisis con mucho contexto, guardamos el metadata pero el texto
        // que se muestra en el bubble es el título, no el prompt completo
        const displayText = contextMeta?.title || text;

        chat.value.push({
            role: 'user',
            text: displayText,
            context: contextMeta || null
        });
        addToMemory('user', text);

        chatInput.value = '';
        chatLoading.value = true;

        try {
            const finalMessage = useMcp.value
                ? buildMcpMessage(text)
                : buildNormalMessage(text);

            const response = await api.agentQuery(finalMessage, useMcp.value);
            const answer = response.data.answer;

            chat.value.push({ role: 'bot', text: answer });
            addToMemory('bot', answer);
        } catch {
            const errorText = useMcp.value
                ? 'No pude conectar con el agente MCP. Revisa AnythingLLM, Ollama y la configuración del MCP.'
                : 'No pude conectar con el chat. Revisa AnythingLLM y Ollama.';
            chat.value.push({ role: 'bot', text: errorText });
            addToMemory('bot', errorText);
        } finally {
            chatLoading.value = false;
        }
    }

    function clearSession() {
        chatMemory.value = [];
        chat.value = [
            { role: 'bot', text: 'Sesión limpiada. ¿En qué podemos trabajar ahora?' }
        ];
    }

    function renderMarkdown(text) {
        if (!text) return '';
        const clean = String(text).replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        return marked.parse(clean);
    }

    return {
        chat, chatInput, chatLoading, useMcp, chatMemory,
        sendChat, clearSession, renderMarkdown,
        compactPrompt, addToMemory
    };
});
