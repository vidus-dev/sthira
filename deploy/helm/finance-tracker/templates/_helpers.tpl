{{/* Expand the name of the chart. */}}
{{- define "finance-tracker.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Fully qualified app name. */}}
{{- define "finance-tracker.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "finance-tracker.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Common labels. */}}
{{- define "finance-tracker.labels" -}}
helm.sh/chart: {{ include "finance-tracker.chart" . }}
app.kubernetes.io/name: {{ include "finance-tracker.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/* Selector labels for a given component (pass dict with root + component). */}}
{{- define "finance-tracker.selectorLabels" -}}
app.kubernetes.io/name: {{ include "finance-tracker.name" .root }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{/* ServiceAccount name. */}}
{{- define "finance-tracker.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "finance-tracker.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{/* The Secret name the API reads SECRET_KEY / DATABASE_URL from. */}}
{{- define "finance-tracker.secretName" -}}
{{- if .Values.secret.existingSecret -}}
{{- .Values.secret.existingSecret -}}
{{- else -}}
{{- printf "%s-app" (include "finance-tracker.fullname" .) -}}
{{- end -}}
{{- end -}}

{{/* Image refs. */}}
{{- define "finance-tracker.apiImage" -}}
{{- $tag := default .Chart.AppVersion .Values.image.apiTag -}}
{{- printf "%s/%s/%s:%s" .Values.image.registry .Values.image.repository .Values.image.apiName $tag -}}
{{- end -}}

{{- define "finance-tracker.webImage" -}}
{{- $tag := default .Chart.AppVersion .Values.image.webTag -}}
{{- printf "%s/%s/%s:%s" .Values.image.registry .Values.image.repository .Values.image.webName $tag -}}
{{- end -}}
