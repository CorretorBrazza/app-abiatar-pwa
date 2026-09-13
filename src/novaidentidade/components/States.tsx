// Estados obrigatórios — Bloco E aprovado.
// loading (skeleton contextual), empty, error (retentativa), forbidden (retorno),
// offline/stale (com hora), success/pending em ações.

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LockKeyhole, RefreshCw, WifiOff } from 'lucide-react-native';
import { colors, font, fonts, radius, semantic, shadow, statusTone } from '../tokens';

const base = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    paddingHorizontal: 24,
  },
  box: {
    alignItems: 'center',
    maxWidth: 380,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    color: semantic.textPrimary,
    fontFamily: font.display,
    fontWeight: '800' as const,
    fontSize: 15,
    textAlign: 'center',
  },
  message: {
    marginTop: 6,
    color: semantic.textMuted,
    fontFamily: font.body,
    fontWeight: '400' as const,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  button: {
    marginTop: 18,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  buttonText: {
    color: '#fff',
    fontFamily: font.body,
    fontWeight: '700' as const,
    fontSize: 12,
  },
});

export function SkeletonBlock({
  lines = 3,
  height = 440,
}: {
  lines?: number;
  height?: number;
}) {
  return (
    <View style={{ gap: 12, paddingVertical: 8 }} accessibilityLabel="Carregando">
      <View style={[styles.skeleton, { height: 18, width: '38%' }]} />
      <View style={[styles.skeleton, { height: 10, width: '55%' }]} />
      {Array.from({ length: lines }).map((_, i) => (
        <View key={i} style={[styles.skeleton, { height: i === lines - 1 ? 72 : 84, opacity: 1 - i * 0.12 }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    borderRadius: radius.md,
    backgroundColor: colors.slate200,
  },
});

export function StateEmpty({
  title,
  message,
  actionLabel,
  onAction,
  tone = 'neutral',
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: keyof typeof statusTone;
}) {
  const t = statusTone[tone];
  return (
    <View style={base.wrap}>
      <View style={base.box}>
        <View style={[base.icon, { backgroundColor: t.bg }]}>
          <ActivityIndicator size="small" color={t.fg} />
        </View>
        <Text style={base.title}>{title}</Text>
        <Text style={base.message}>{message}</Text>
        {actionLabel && onAction && (
          <TouchableOpacity
            style={[base.button, { backgroundColor: colors.coral600 }]}
            onPress={onAction}
            activeOpacity={0.85}
          >
            <Text style={base.buttonText}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export function StateError({
  title = 'Não foi possível carregar',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={base.wrap}>
      <View style={base.box}>
        <View style={[base.icon, { backgroundColor: colors.red100 }]}>
          <RefreshCw size={20} color={colors.red700} />
        </View>
        <Text style={[base.title, { color: colors.red700 }]}>{title}</Text>
        <Text style={base.message}>{message}</Text>
        {onRetry && (
          <TouchableOpacity
            style={[base.button, { backgroundColor: colors.red700 }]}
            onPress={onRetry}
            activeOpacity={0.85}
          >
            <RefreshCw size={14} color="#fff" />
            <Text style={base.buttonText}>Tentar novamente</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export function StateForbidden({
  title = 'Acesso restrito',
  message = 'Seu perfil não tem permissão para esta área. Fale com seu gerente se precisar de acesso.',
  onBack,
}: {
  title?: string;
  message?: string;
  onBack?: () => void;
}) {
  return (
    <View style={base.wrap}>
      <View style={base.box}>
        <View style={[base.icon, { backgroundColor: colors.amber100 }]}>
          <LockKeyhole size={20} color={colors.amber700} />
        </View>
        <Text style={base.title}>{title}</Text>
        <Text style={base.message}>{message}</Text>
        {onBack && (
          <TouchableOpacity
            style={[base.button, { backgroundColor: colors.navy800 }]}
            onPress={onBack}
            activeOpacity={0.85}
          >
            <Text style={base.buttonText}>Voltar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export function StateOffline({
  updatedAt,
  onRetry,
}: {
  updatedAt?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={[base.wrap, { paddingVertical: 28 }]}>
      <View style={base.box}>
        <View style={[base.icon, { backgroundColor: colors.slate100 }]}>
          <WifiOff size={20} color={colors.slate600} />
        </View>
        <Text style={[base.title, { color: colors.slate700 }]}>Sem conexão</Text>
        <Text style={base.message}>
          {updatedAt ? `Dados exibidos de ${updatedAt}.` : 'Dados podem estar desatualizados.'}
        </Text>
        {onRetry && (
          <TouchableOpacity
            style={[base.button, { backgroundColor: colors.navy800 }]}
            onPress={onRetry}
            activeOpacity={0.85}
          >
            <RefreshCw size={14} color="#fff" />
            <Text style={base.buttonText}>Tentar reconectar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export function StaleBanner({ updatedAt }: { updatedAt: string }) {
  return (
    <View style={staleStyles.row}>
      <View style={staleStyles.dot} />
      <Text style={staleStyles.text}>Atualizado {updatedAt}</Text>
    </View>
  );
}

const staleStyles = StyleSheet.create({
  row: {
    alignSelf: 'flex-start',
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.slate100,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.slate500,
  },
  text: {
    color: colors.slate600,
    fontFamily: font.body,
    fontWeight: '600' as const,
    fontSize: 9.5,
  },
});

export function CardSkeleton() {
  return (
    <View style={cardSk.wrap}>
      <View style={[styles.skeleton, { height: 16, width: 96 }]} />
      <View style={[styles.skeleton, { height: 26, width: 60, marginTop: 10 }]} />
    </View>
  );
}

const cardSk = StyleSheet.create({
  wrap: {
    backgroundColor: semantic.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: semantic.border,
    padding: 18,
    ...shadow.card,
  },
});