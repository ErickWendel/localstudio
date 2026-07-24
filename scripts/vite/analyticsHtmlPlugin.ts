import type { Plugin } from 'vite';
import { localStudioAnalyticsConfig } from '@localstudio/analytics-config/config';

const analyticsHtmlPlaceholder = '<!-- localstudio:analytics -->';

function getGoogleAnalyticsHtml() {
  const { measurementId } = localStudioAnalyticsConfig.googleAnalytics;
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        dataLayer.push(arguments);
      }
      gtag("js", new Date());

      gtag("config", "${measurementId}");
    </script>`;
}

export function analyticsHtmlPlugin(): Plugin {
  return {
    name: 'localstudio-analytics-html',
    transformIndexHtml(html) {
      return html.replace(analyticsHtmlPlaceholder, getGoogleAnalyticsHtml());
    },
  };
}
