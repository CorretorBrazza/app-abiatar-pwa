import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  ImageSourcePropType,
  GestureResponderEvent,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

export const APP_ICONS = {
  administrarPlantoes: require('../../assets/icones/administrar_plantoes_e_regras.png'),
  ativarPush: require('../../assets/icones/ativar_push.png'),
  checkIn: require('../../assets/icones/check_in.png'),
  comunicacaoInstitucional: require('../../assets/icones/comunicacao_institucional.png'),
  gerenciarEquipes: require('../../assets/icones/gerenciar_equipes.png'),
  gerenciarGerentesRecepcao: require('../../assets/icones/gerenciar_gerentes_recepcao.png'),
  inteligenciaBi: require('../../assets/icones/inteligencia_bi.png'),
  mensagens: require('../../assets/icones/mensagens.png'),
  meusPlantoes: require('../../assets/icones/meus_plantoes.png'),
  sair: require('../../assets/icones/sair.png'),
};

export const ABIATAR_RED = '#e53924';
export const ABIATAR_DARK_RED = '#c13a28';

export interface IconButtonProps {
  /** Nome do ícone Feather (ex: 'check', 'edit-2', 'trash-2', 'arrow-left') */
  name?: keyof typeof Feather.glyphMap;
  /** Imagem PNG do ícone (ex: APP_ICONS.administrarPlantoes) */
  imageSource?: ImageSourcePropType;
  /** Ícone customizado passado diretamente como ReactNode */
  icon?: React.ReactNode;
  /** Texto/nome que hoje está no botão, posicionado abaixo e centralizado */
  label?: string;
  /** Ação disparada ao clicar */
  onPress: (event?: GestureResponderEvent) => void;
  /** Tamanho predefinido ('small' | 'medium' | 'large') ou número customizado */
  size?: 'small' | 'medium' | 'large' | number;
  /** Cor do contorno (padrão: vermelho abiatar #e53924) */
  borderColor?: string;
  /** Cor do ícone Feather (padrão: vermelho abiatar #e53924) */
  color?: string;
  /** Cor de fundo do quadrado/círculo do ícone (padrão: #ffffff) */
  backgroundColor?: string;
  /** Cor do texto do label */
  textColor?: string;
  /** Estado de carregamento com spinner */
  loading?: boolean;
  /** Estado desabilitado */
  disabled?: boolean;
  /** Badge numérico ou texto no canto superior direito */
  badge?: number | string | null;
  /** Tooltip no navegador para acessibilidade */
  title?: string;
  /** Estilo do container externo (inclui o ícone e o label) */
  containerStyle?: ViewStyle | (ViewStyle | undefined)[];
  /** Estilo da caixa com contorno onde fica o ícone */
  buttonStyle?: ViewStyle | (ViewStyle | undefined)[];
  /** Estilo do texto do label */
  labelStyle?: TextStyle | (TextStyle | undefined)[];
  /** Rótulo de acessibilidade */
  accessibilityLabel?: string;
}

export default function IconButton({
  name,
  imageSource,
  icon,
  label,
  onPress,
  size = 'large',
  borderColor = ABIATAR_RED,
  color = ABIATAR_RED,
  backgroundColor = '#ffffff',
  textColor = '#1c1c1e',
  loading = false,
  disabled = false,
  badge,
  title,
  containerStyle,
  buttonStyle,
  labelStyle,
  accessibilityLabel,
}: IconButtonProps) {
  // Configuração dimensional baseada no tamanho
  let boxSize = 72;
  let iconSize = 34;
  let imageSize = 48;
  let borderRadius = 18;
  let labelFontSize = 12;
  let containerWidth: number | string = 105;

  if (size === 'small') {
    boxSize = 42;
    iconSize = 20;
    imageSize = 26;
    borderRadius = 10;
    labelFontSize = 10;
    containerWidth = 72;
  } else if (size === 'medium') {
    boxSize = 56;
    iconSize = 26;
    imageSize = 36;
    borderRadius = 14;
    labelFontSize = 11;
    containerWidth = 88;
  } else if (typeof size === 'number') {
    boxSize = size;
    iconSize = Math.round(size * 0.48);
    imageSize = Math.round(size * 0.68);
    borderRadius = Math.round(size * 0.25);
    labelFontSize = 11;
    containerWidth = Math.round(size * 1.3);
  }

  const activeBorderColor = disabled ? '#f0b5ab' : borderColor;
  const activeIconColor = disabled ? '#f0b5ab' : color;
  const activeLabelColor = disabled ? '#9ca3af' : textColor;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      // @ts-ignore - nativo no React Native Web
      title={title || label}
      accessibilityLabel={accessibilityLabel || label || title}
      accessibilityRole="button"
      style={[
        styles.container,
        containerWidth ? { width: containerWidth } : null,
        containerStyle,
      ]}
    >
      {/* Caixa do ícone com contorno vermelho abiatar */}
      <View
        style={[
          styles.iconBox,
          {
            width: boxSize,
            height: boxSize,
            borderRadius,
            borderColor: activeBorderColor,
            backgroundColor: disabled ? '#fff5f5' : backgroundColor,
          },
          buttonStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={activeBorderColor} />
        ) : icon ? (
          icon
        ) : imageSource ? (
          <Image
            source={imageSource}
            style={[styles.image, { width: imageSize, height: imageSize, opacity: disabled ? 0.4 : 1 }]}
            resizeMode="contain"
          />
        ) : name ? (
          <Feather name={name} size={iconSize} color={activeIconColor} />
        ) : null}

        {/* Badge numérico (ex: mensagens não lidas) */}
        {badge !== undefined && badge !== null && badge !== 0 && (
          <View style={[styles.badge, { backgroundColor: borderColor }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>

      {/* Nome do botão abaixo e centralizado */}
      {label ? (
        <Text
          numberOfLines={2}
          style={[
            styles.label,
            {
              fontSize: labelFontSize,
              color: activeLabelColor,
            },
            labelStyle,
          ]}
        >
          {label}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginVertical: 6,
    marginHorizontal: 4,
  },
  iconBox: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  image: {
    alignSelf: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  label: {
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '700',
    lineHeight: 15,
  },
});
