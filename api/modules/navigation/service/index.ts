import type { AuthUser } from '../../../middleware/bearerAuth';

/**
 * Service navigasi — menghimpun angka badge sidebar dari modul yang sudah ada.
 *
 * Angka selalu berasal dari sumber kanonik (service cuti & disposisi), bukan
 * hitungan ulang di klien. Modul lain diimpor dinamis agar tidak ada siklus
 * dependensi saat modul-modul ini saling merujuk.
 */

const yearNow = () => new Date().getFullYear();

export const getNavigationBadges = async (user?: AuthUser | null) => {
  let leavePending = 0;
  let dispositionPending = 0;
  let quotaRemaining = 0;

  if (!user) {
    return {
      disposition_pending: 0,
      leave_pending: 0,
      quota_remaining_days: 0,
    };
  }

  const isStaff = user.role === 'admin' || user.role === 'verifikator' || user.role === 'atasan';

  try {
    const leaveService = await import('../../leave/service');

    if (isStaff) {
      try {
        const dispositionService = await import('../../dispositions/service');
        const [leaveList, incomingList] = await Promise.all([
          leaveService.listLeaveRequests({ status: 'in_review', perPage: 1 }).catch(() => ({ total: 0 })),
          dispositionService.listIncomingLetters({ status: 'baru', perPage: 1 }).catch(() => ({ total: 0 })),
        ]);
        leavePending = leaveList?.total ?? 0;
        dispositionPending = incomingList?.total ?? 0;
      } catch {
        // Fallback aman bila modul disposisi belum tersedia
      }
    }

    try {
      const quota = await leaveService.getQuotaSummary(Number(user.id), yearNow());
      quotaRemaining = quota?.available?.total ?? 0;
    } catch {
      // User tanpa NIP/TMT atau belum eligible tidak membuat request gagal
      quotaRemaining = 0;
    }
  } catch {
    // Fallback aman untuk keseluruhan modul
  }

  return {
    disposition_pending: dispositionPending,
    leave_pending: leavePending,
    quota_remaining_days: quotaRemaining,
  };
};
