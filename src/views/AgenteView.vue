<script setup>
/**
 * AgenteView.vue — Chat con IA rediseñado.
 */
import { ref, nextTick, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useChatStore } from '../stores/useChatStore.js';
import { useAgentPrompts } from '../composables/useAgentPrompts.js';
import ChatContextSummary from '../components/ChatContextSummary.vue';
import Button from 'primevue/button';
import Textarea from 'primevue/textarea';
import InputSwitch from 'primevue/inputswitch';

const chatStore = useChatStore();
const { chat, chatInput, chatLoading, useMcp } = storeToRefs(chatStore);
const {
    triggerAnalysis,
    triggerBrechaAnalysis,
    triggerCompetenciaAnalysis,
    triggerOficialesAnalysis,
    triggerRiesgoAnalysis,
    triggerCaptacionesAnalysis,
    triggerOportunidadesAnalysis
} = useAgentPrompts();

const messagesEl = ref(null);

watch(chat, async () => {
    await nextTick();
    if (messagesEl.value) {
        messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
    }
}, { deep: true });

function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatStore.sendChat();
    }
}

const quickActions = [
    { label: 'Análisis integral', icon: 'chart-line', fn: () => triggerAnalysis({ fullData: true }), color: 'green' },
    { label: 'Brecha presupuestaria', icon: 'bullseye', fn: triggerBrechaAnalysis, color: 'purple' },
    { label: 'Competencia', icon: 'building-columns', fn: triggerCompetenciaAnalysis, color: 'blue' },
    { label: 'Oficiales', icon: 'user-tie', fn: triggerOficialesAnalysis, color: 'amber' },
    { label: 'Riesgos', icon: 'triangle-exclamation', fn: triggerRiesgoAnalysis, color: 'red' },
    { label: 'Captaciones', icon: 'piggy-bank', fn: triggerCaptacionesAnalysis, color: 'indigo' },
    { label: 'Oportunidades', icon: 'lightbulb', fn: triggerOportunidadesAnalysis, color: 'green' }
];
</script>

<template>
    <div class="agente-layout">
        <aside class="agente-panel">
            <div class="panel-header">
                <font-awesome-icon icon="bolt" />
                <span>Análisis rápidos</span>
            </div>

            <div class="quick-actions">
                <button
                    v-for="action in quickActions"
                    :key="action.label"
                    class="quick-btn"
                    :class="`quick-btn-${action.color}`"
                    :disabled="chatLoading"
                    @click="action.fn()"
                >
                    <font-awesome-icon :icon="action.icon" />
                    <span>{{ action.label }}</span>
                    <font-awesome-icon icon="arrow-right" class="quick-arrow" />
                </button>
            </div>

            <div class="panel-divider" />

            <div class="panel-controls">
                <div class="mcp-toggle">
                    <div class="mcp-label">
                        <font-awesome-icon icon="robot" />
                        <div>
                            <strong>Modo MCP</strong>
                            <small>AnythingLLM + herramientas</small>
                        </div>
                    </div>
                    <InputSwitch v-model="useMcp" />
                </div>

                <Button
                    label="Limpiar sesión"
                    icon="pi pi-trash"
                    outlined
                    severity="secondary"
                    size="small"
                    class="clear-btn"
                    @click="chatStore.clearSession()"
                />
            </div>
        </aside>

        <div class="agente-chat">
            <div ref="messagesEl" class="chat-messages">
                <div
                    v-for="(msg, idx) in chat"
                    :key="idx"
                    class="chat-message"
                    :class="msg.role === 'user' ? 'msg-user' : 'msg-bot'"
                >
                    <div class="msg-avatar" :class="msg.role === 'user' ? 'avatar-user' : 'avatar-bot'">
                        <font-awesome-icon :icon="msg.role === 'user' ? 'user-tie' : 'robot'" />
                    </div>

                    <div class="msg-body">
                        <template v-if="msg.role === 'user'">
                            <ChatContextSummary
                                v-if="msg.context"
                                :title="msg.context.title"
                                :sections="msg.context.sections"
                                :prompt-text="msg.context.promptText"
                            />
                            <div v-else class="chat-bubble bubble-user">{{ msg.text }}</div>
                        </template>

                        <div
                            v-else
                            class="chat-bubble bubble-bot markdown-body"
                            v-html="chatStore.renderMarkdown(msg.text)"
                        />
                    </div>
                </div>

                <div v-if="chatLoading" class="chat-message msg-bot">
                    <div class="msg-avatar avatar-bot">
                        <font-awesome-icon icon="robot" />
                    </div>
                    <div class="msg-body">
                        <div class="chat-bubble bubble-bot typing-indicator">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="chat-input-area">
                <Textarea
                    v-model="chatInput"
                    placeholder="Escribe tu pregunta o usa los análisis rápidos del panel izquierdo..."
                    :rows="2"
                    autoResize
                    class="chat-textarea"
                    @keydown="handleKeydown"
                />
                <Button
                    class="send-btn"
                    :loading="chatLoading"
                    :disabled="!chatInput.trim() && !chatLoading"
                    @click="chatStore.sendChat()"
                >
                    <font-awesome-icon icon="arrow-right" />
                </Button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.agente-layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 20px;
    height: calc(100vh - 140px);
    min-height: 600px;
}
.agente-panel {
    background: var(--white);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow-y: auto;
}
.panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--muted);
    padding-bottom: 10px;
    border-bottom: 1px solid var(--line);
}
.quick-actions { display: flex; flex-direction: column; gap: 6px; }
.quick-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--soft);
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    color: var(--ink);
    text-align: left;
    transition: all 0.18s ease;
}
.quick-btn:hover:not(:disabled) {
    background: var(--bnb-green-soft);
    border-color: var(--bnb-green);
    color: var(--bnb-green-dark);
    transform: translateX(2px);
}
.quick-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.quick-arrow { margin-left: auto; font-size: 11px; opacity: 0.5; }
.panel-divider { height: 1px; background: var(--line); }
.panel-controls { display: flex; flex-direction: column; gap: 12px; margin-top: auto; }
.mcp-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 12px;
    border-radius: 10px;
    background: var(--soft);
    border: 1px solid var(--line);
}
.mcp-label { display: flex; align-items: center; gap: 10px; font-size: 12px; }
.mcp-label strong { display: block; font-size: 13px; }
.mcp-label small { color: var(--muted); font-size: 11px; }
.clear-btn { width: 100%; }
.agente-chat {
    display: flex;
    flex-direction: column;
    background: var(--white);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    overflow: hidden;
}
.chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    scroll-behavior: smooth;
}
.chat-message { display: flex; gap: 12px; align-items: flex-start; }
.msg-user { flex-direction: row-reverse; }
.msg-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    font-size: 15px;
}
.avatar-bot {
    background: linear-gradient(135deg, var(--bnb-green-dark), var(--bnb-green));
    color: white;
}
.avatar-user {
    background: linear-gradient(135deg, var(--bnb-purple), #6d28d9);
    color: white;
}
.msg-body { flex: 1; max-width: 82%; }
.msg-user .msg-body { display: flex; justify-content: flex-end; }
.chat-bubble { padding: 14px 18px; border-radius: 16px; font-size: 14px; line-height: 1.65; }
.bubble-user {
    background: linear-gradient(135deg, var(--bnb-purple), #6d28d9);
    color: white;
    border-radius: 16px 16px 4px 16px;
}
.bubble-bot {
    background: var(--soft);
    border: 1px solid var(--line);
    border-radius: 4px 16px 16px 16px;
    width: 100%;
}
.markdown-body :deep(h1), .markdown-body :deep(h2), .markdown-body :deep(h3) {
    font-size: 15px;
    margin: 14px 0 6px;
}
.markdown-body :deep(p) { margin: 6px 0; }
.markdown-body :deep(ul), .markdown-body :deep(ol) { padding-left: 20px; margin: 6px 0; }
.markdown-body :deep(table) { border-collapse: collapse; width: 100%; font-size: 12px; margin: 10px 0; }
.markdown-body :deep(th), .markdown-body :deep(td) { border: 1px solid var(--line); padding: 6px 10px; }
.markdown-body :deep(th) { background: var(--bnb-green-soft); font-weight: 700; }
.typing-indicator { display: flex; align-items: center; gap: 5px; padding: 12px 18px; width: fit-content; }
.typing-indicator span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--bnb-green);
    animation: typing 1.2s infinite;
}
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
@keyframes typing {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
    40% { transform: translateY(-6px); opacity: 1; }
}
.chat-input-area {
    display: flex;
    gap: 10px;
    align-items: flex-end;
    padding: 16px 20px;
    border-top: 1px solid var(--line);
    background: var(--soft);
}
.chat-textarea { flex: 1; border-radius: 12px !important; resize: none; font-size: 14px; }
.send-btn {
    width: 46px !important;
    height: 46px !important;
    border-radius: 12px !important;
    background: var(--bnb-green) !important;
    border: none !important;
    color: white !important;
    flex-shrink: 0;
}
@media (max-width: 900px) {
    .agente-layout { grid-template-columns: 1fr; height: auto; }
    .agente-chat { height: 70vh; }
    .quick-actions { display: grid; grid-template-columns: repeat(2, 1fr); }
}
</style>
