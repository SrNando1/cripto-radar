// Mantido para compatibilidade: o polling vive agora em CoinsContext,
// partilhado por toda a app para que os alertas possam ser verificados globalmente.
export { useCoins } from '../context/CoinsContext'
