variable "name" {
  description = "Name of the Storage Box and prefix for its sub-accounts."
  type        = string
  default     = "aether-stream"
}

variable "location" {
  description = "Hetzner location. Must be the same as the server's (bx11 is sold in fsn1 and hel1)."
  type        = string
  default     = "fsn1"
}

variable "storage_box_type" {
  description = "bx11 = 1.1 TB (about EUR 3.20/month), bx21 = 5.5 TB, bx31 = 11 TB."
  type        = string
  default     = "bx11"
}

variable "external_access" {
  description = <<-EOT
    Allow access from outside Hetzner's network (your home PC). Turn on only while
    uploading the library (M5), then set it back to false and apply again.
  EOT
  type        = bool
  default     = false
}
