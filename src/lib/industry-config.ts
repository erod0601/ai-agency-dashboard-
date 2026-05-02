export type IndustryConfig = {
  metricLabels: {
    totalCalls: string;
    bookings: string;
    missedCalls: string;
    conversionRate: string;
  };
  callOutcomeLabels: {
    booked: string;
    inquiry: string;
    notInterested: string;
    voicemail: string;
  };
};

const configs: Record<string, IndustryConfig> = {
  med_spa: {
    metricLabels: {
      totalCalls: "Total Calls",
      bookings: "Appointments Booked",
      missedCalls: "Missed Calls",
      conversionRate: "Booking Rate",
    },
    callOutcomeLabels: {
      booked: "Appointment Booked",
      inquiry: "Inquiry Only",
      notInterested: "Not Interested",
      voicemail: "Voicemail",
    },
  },
  home_services: {
    metricLabels: {
      totalCalls: "Total Calls",
      bookings: "Jobs Scheduled",
      missedCalls: "Missed Calls",
      conversionRate: "Close Rate",
    },
    callOutcomeLabels: {
      booked: "Job Scheduled",
      inquiry: "Quote Requested",
      notInterested: "Not Interested",
      voicemail: "Voicemail",
    },
  },
};

export function getIndustryConfig(industry?: string): IndustryConfig {
  return configs[industry ?? ""] ?? configs.med_spa;
}
