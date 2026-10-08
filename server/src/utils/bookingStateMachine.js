const transitions = {
  PENDING: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["EN_ROUTE", "CANCELLED"],
  EN_ROUTE: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["PAID", "DISPUTED"],
  PAID: ["DISPUTED"],
  REJECTED: [],
  CANCELLED: [],
  DISPUTED: []
};

export function canTransitionBooking(currentStatus, nextStatus) {
  return transitions[currentStatus]?.includes(nextStatus) || false;
}

export function getAllowedBookingTransitions(status) {
  return [...(transitions[status] || [])];
}

export default { canTransitionBooking, getAllowedBookingTransitions };
