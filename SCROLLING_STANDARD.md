# Padrão de rolagem de telas ABIATAR

Todas as telas operacionais e dashboards devem assumir que o conteúdo pode ultrapassar a altura da viewport, especialmente em celulares.

## Regra obrigatória

Uma tela com conteúdo vertical deve usar um único container principal rolável: `ScrollView` para conteúdo composto ou `FlatList` para listas. O container deve ocupar `flex: 1`, usar `contentContainerStyle` com `paddingBottom` suficiente e manter `showsVerticalScrollIndicator` habilitado durante a homologação.

Não se deve colocar um `FlatList` dentro de um `ScrollView` vertical com rolagem própria. Quando uma tela tiver cards e uma lista, a lista deve usar `ListFooterComponent`, `ListHeaderComponent` ou uma composição equivalente para manter uma única rolagem.

O estado inicial e o estado pós-ação de uma mesma tela também devem ser auditados separadamente. No Dashboard do Corretor, por exemplo, `[CR-01]` usa `FlatList` e `[CR-02]` usa `ScrollView`; ambos precisam comportar períodos, materiais, Inbox, notificações e saída.

## Checklist antes de publicar uma nova tela

Verificar celular estreito, celular largo e desktop; confirmar que o último botão é alcançável; testar conteúdo vazio e conteúdo extenso; verificar que teclado e modais não bloqueiam a rolagem; evitar `height` fixo no container de conteúdo; e preservar `paddingBottom` para que o último item não fique escondido atrás da navegação do dispositivo.
