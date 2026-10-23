import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MediaItem } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { apiClient } from '../services/api';
import { storage } from '../services/storage';
import {
  ArrowLeft,
  Share2,
  Trash2,
  Download,
  CheckCircle2,
  Video,
} from 'lucide-react-native';

interface MediaModalViewerProps {
  item: MediaItem | null;
  serverUrl: string;
  canDownload?: boolean;
  onClose: () => void;
  onDeleted?: (id: string) => void;
}

const { width, height } = Dimensions.get('window');

export function MediaModalViewer({
  item,
  serverUrl,
  canDownload = true,
  onClose,
  onDeleted,
}: MediaModalViewerProps) {
  const { colors } = useTheme();
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!item) return null;

  const cleanServer = serverUrl.replace(/\/+$/, '');
  const mediaUrl = `${cleanServer}/api/media/${item.id}`;

  const handleShare = async () => {
    setSharing(true);
    try {
      const res = await apiClient('/api/me/shares', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Shared Memory',
          mediaIds: [item.id],
        }),
      });

      if (res.share) {
        const shareUrl = res.share.shareUrl || `${cleanServer}/s/${res.share.slug}`;
        await Share.share({
          title: 'Shared Photo from Gather',
          message: `Check out this photo from the event: ${shareUrl}`,
          url: shareUrl,
        });
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err: any) {
      Alert.alert('Share Failed', err.message || 'Could not generate share link');
    } finally {
      setSharing(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Media',
      'Are you sure you want to permanently delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await apiClient(`/api/media/${item.id}`, { method: 'DELETE' });
              onDeleted?.(item.id);
              onClose();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete photo');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={!!item} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.container}>
        <SafeAreaView style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={onClose}>
            <ArrowLeft size={20} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.actionPill, copied && { backgroundColor: '#10b981' }]}
              onPress={handleShare}
              disabled={sharing}
            >
              {sharing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : copied ? (
                <>
                  <CheckCircle2 size={14} color="#ffffff" />
                  <Text style={styles.actionPillText}>Shared!</Text>
                </>
              ) : (
                <>
                  <Share2 size={14} color="#ffffff" />
                  <Text style={styles.actionPillText}>Share</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: 'rgba(239,68,68,0.2)' }]}
              onPress={handleDelete}
              disabled={deleting}
            >
              <Trash2 size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Media display area */}
        <View style={styles.mediaContainer}>
          <Image
            source={{ uri: mediaUrl }}
            style={styles.image}
            resizeMode="contain"
          />
          {item.kind === 'video' && (
            <View style={styles.videoOverlay}>
              <Video size={48} color="#ffffff" />
              <Text style={styles.videoText}>Video Capture</Text>
            </View>
          )}
        </View>

        {/* Footer info bar */}
        <SafeAreaView style={styles.footer}>
          <Text style={styles.footerText}>
            {item.uploaderName ? `Uploaded by ${item.uploaderName} • ` : ''}
            {new Date(item.createdAt).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    zIndex: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  actionPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  mediaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: width,
    height: height * 0.72,
  },
  videoOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 20,
    borderRadius: 16,
  },
  videoText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
});
