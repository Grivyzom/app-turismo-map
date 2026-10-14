package models

import "encoding/json"

type User struct {
	ID        int      `json:"id,omitempty"`
	Email     string   `json:"email"`
	Name      string   `json:"name"`
	Picture   string   `json:"picture,omitempty"`
	UserType  string   `json:"userType,omitempty"` // "citizen", "tourist", "partner_owner", "partner_worker"
	Status    string   `json:"status,omitempty"`   // "active", "pending", "suspended"
	ClerkID   string   `json:"clerkId,omitempty"`
	Company   *Company `json:"company,omitempty"`
	CreatedAt string   `json:"createdAt,omitempty"`
	UpdatedAt string   `json:"updatedAt,omitempty"`
}

type Company struct {
	ID                 int    `json:"id"`
	BusinessName       string `json:"businessName"`
	EntityType         string `json:"entityType"`
	VerificationStatus string `json:"verificationStatus"`
	Phone              string `json:"phone,omitempty"`
	Role               string `json:"role,omitempty"` // Role of the user in this company
}

type RegisterRequest struct {
	Email        string `json:"email"`
	Password     string `json:"password"`
	Name         string `json:"name"` // Nombre de la persona
	BusinessName string `json:"businessName,omitempty"` // Nombre de la empresa (si aplica)
	UserType     string `json:"userType"`   // "citizen", "partner_owner"
	EntityType   string `json:"entityType"` // "business", "independent", "authority"
	Phone        string `json:"phone"`      // Teléfono de contacto
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthRequest struct {
	IDToken  string `json:"idToken"`
	UserType string `json:"userType,omitempty"`
}

type ClerkAuthRequest struct {
	Token    string `json:"token"`
	UserType string `json:"userType,omitempty"`
}

type AuthResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	User    User   `json:"user"`
	Token   string `json:"token,omitempty"`
}

type PreferencesRequest map[string]interface{}

// ── Admin Panel Models ──────────────────────────────────────────────────

// AdminUser representa un administrador del sistema. Tabla separada de users.
type AdminUser struct {
	ID        int    `json:"id"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	Role      string `json:"role"`      // "superadmin", "admin", "moderator"
	Status    string `json:"status"`    // "active", "suspended", "pending_2fa"
	TOTPReady bool   `json:"totpReady"` // true si ya configuró su 2FA
}

// AdminLoginRequest es el paso 1: email + contraseña.
type AdminLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// AdminLoginResponse responde al paso 1 con un challenge temporal si se requiere 2FA.
type AdminLoginResponse struct {
	Success      bool      `json:"success"`
	Message      string    `json:"message"`
	Requires2FA  bool      `json:"requires2fa,omitempty"`
	ChallengeID  string    `json:"challengeId,omitempty"` // ID temporal para el paso 2
	Admin        AdminUser `json:"admin,omitempty"`
	Token        string    `json:"token,omitempty"`        // Solo se envía si NO requiere 2FA (setup inicial)
	TOTPSetupURI string    `json:"totpSetupUri,omitempty"` // URI otpauth:// para registrar en app 2FA
	TOTPSetupKey string    `json:"totpSetupKey,omitempty"` // Clave base32 legible para ingreso manual
}

// AdminVerify2FARequest es el paso 2: verificar código TOTP.
type AdminVerify2FARequest struct {
	ChallengeID string `json:"challengeId"`
	TOTPCode    string `json:"totpCode"`
}

// AdminSessionResponse es la respuesta final después de la verificación 2FA.
type AdminSessionResponse struct {
	Success bool      `json:"success"`
	Message string    `json:"message"`
	Admin   AdminUser `json:"admin,omitempty"`
	Token   string    `json:"token,omitempty"`
}

// AuditLogEntry representa una entrada en el registro de auditoría.
type AuditLogEntry struct {
	ID        int    `json:"id"`
	AdminID   int    `json:"adminId,omitempty"`
	Action    string `json:"action"` // "login_success", "login_failed", "2fa_failed", "logout"
	IPAddress string `json:"ipAddress"`
	UserAgent string `json:"userAgent"`
	Details   string `json:"details,omitempty"`
	CreatedAt string `json:"createdAt"`
}

// HeatmapZone representa la densidad de interacciones en una zona geoespacial.
type HeatmapZone struct {
	Zone  string `json:"zone"`
	Count int    `json:"count"`
}

// AdminKPIs representa los KPIs de rendimiento del software.
type AdminKPIs struct {
	TotalUsers           int            `json:"totalUsers"`
	ActiveUsers          int            `json:"activeUsers"`
	RegisteredLast7Days  int            `json:"registeredLast7Days"`
	RegisteredLast30Days int            `json:"registeredLast30Days"`
	UserTypes            map[string]int `json:"userTypes"`
	UserStatuses         map[string]int `json:"userStatuses"`
	TotalCompanies       int            `json:"totalCompanies"`
	TotalEvents          int            `json:"totalEvents"`
	TotalReports         int            `json:"totalReports"`
	Hotspots             []HeatmapZone  `json:"hotspots"`
	AvgActivityTime      float64        `json:"avgActivityTime"` // en minutos
	OfflineUsageRate     float64        `json:"offlineUsageRate"` // en porcentaje (0-100)
}

// ── Global Trends Models ──────────────────────────────────────────────────

type CategoryTrend struct {
	Category string `json:"category"`
	Count    int    `json:"count"`
}

type GlobalTrends struct {
	TopCategories  []CategoryTrend `json:"topCategories"`
	TravelStyles   map[string]int  `json:"travelStyles"`
	StayDurations  map[string]int  `json:"stayDurations"`
	ProfileTypes   map[string]int  `json:"profileTypes"`
	TotalWithPrefs int             `json:"totalWithPreferences"`
}

// ── Models para Sistema de Colecciones y Guardado ──────────────────────────

type Collection struct {
	ID          int    `json:"id"`
	UserID      int    `json:"userId"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Visibility  string `json:"visibility"` // "private", "public"
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
	ItemCount   int    `json:"itemCount,omitempty"` // Campo calculado auxiliar
}

type SavedLocation struct {
	ID           int     `json:"id"`
	CollectionID int     `json:"collectionId"`
	LocationType string  `json:"locationType"` // "event", "custom_pin"
	RefID        string  `json:"refId,omitempty"` // ID del evento o string referencial
	Latitude     float64 `json:"latitude"`
	Longitude    float64 `json:"longitude"`
	Title        string  `json:"title"`
	Notes        string  `json:"notes,omitempty"`
	CreatedAt    string  `json:"createdAt"`
}

type CreateCollectionRequest struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Visibility  string `json:"visibility,omitempty"`
}

type SaveLocationRequest struct {
	CollectionID int     `json:"collectionId"`
	LocationType string  `json:"locationType"`
	RefID        string  `json:"refId,omitempty"`
	Latitude     float64 `json:"latitude"`
	Longitude    float64 `json:"longitude"`
	Title        string  `json:"title"`
	Notes        string  `json:"notes,omitempty"`
}

// ── Models para Delimitación de Zonas (Polígonos) ──────────────────────────

type Zone struct {
	ID           int             `json:"id"`
	Name         string          `json:"name"`
	Description  string          `json:"description,omitempty"`
	Category     string          `json:"category,omitempty"`
	Color        string          `json:"color,omitempty"`
	IsActive     bool            `json:"isActive"`
	GeoJSON      json.RawMessage `json:"geojson"` // Geometría en formato GeoJSON
	EventsCount  int             `json:"eventsCount"`
	Rating       *float64        `json:"rating,omitempty"`
	Images       []string        `json:"images,omitempty"`
	OpeningHours string          `json:"openingHours,omitempty"`
	ParkType     string          `json:"parkType,omitempty"`
}

// ── Models para Sistema de Rutas (Geo-Router) ──────────────────────────

type RouteType string

const (
	RouteDirect       RouteType = "direct"
	RouteSingleTarget RouteType = "single_target"
	RouteMultiTarget  RouteType = "multi_target"
	RouteCiclovia     RouteType = "ciclovia"
	RouteSector       RouteType = "sector"
)

type RouteVisibility string

const (
	RouteVisibilityPrivate  RouteVisibility = "private"
	RouteVisibilityUnlisted RouteVisibility = "unlisted"
	RouteVisibilityPublic   RouteVisibility = "public"
)

type PointType string

const (
	PointOrigin      PointType = "origin"
	PointDestination PointType = "destination"
	PointTarget      PointType = "target"
	PointWaypoint    PointType = "waypoint"
)

type RoutePoint struct {
	ID         int       `json:"id"`
	RouteID    int       `json:"routeId"`
	Latitude   float64   `json:"latitude"`
	Longitude  float64   `json:"longitude"`
	OrderIndex int       `json:"orderIndex"`
	PointType  PointType `json:"pointType"`
	Name       string    `json:"name,omitempty"`
}

type Route struct {
	ID              int             `json:"id"`
	Name            string          `json:"name"`
	Type            RouteType       `json:"type"`
	Category        string          `json:"category"`               // "cervecera", "reto", "turistica", etc.
	BusinessID      *int            `json:"businessId,omitempty"`   // ID del negocio creador
	BusinessName    string          `json:"businessName,omitempty"` // Nombre del negocio (para el frontend)
	UserID          *int            `json:"userId,omitempty"`
	UserName        string          `json:"userName,omitempty"`
	TargetAudience  string          `json:"targetAudience"`
	IsFeatured      bool            `json:"isFeatured"`             // Rutas destacadas (Premium)
	RatingAvg       float64         `json:"ratingAvg"`              // Calificación media por ciudadanos
	Visibility      RouteVisibility `json:"visibility"`             // 'private', 'unlisted', 'public'
	ShareToken      string          `json:"shareToken,omitempty"`
	IsSystemRoute   bool            `json:"isSystemRoute"`
	OriginalRouteID *int            `json:"originalRouteId,omitempty"`
	TransportMode   string          `json:"transportMode"`          // 'foot', 'bike'
	GeomGeoJSON     *string         `json:"geomGeojson,omitempty"`  // GeoJSON LineString
	Points          []RoutePoint    `json:"points,omitempty"`
	CreatedAt       string          `json:"createdAt"`
}

type CreateRouteRequest struct {
	Name           string          `json:"name"`
	Type           RouteType       `json:"type"`
	Category       string          `json:"category"`
	TargetAudience string          `json:"targetAudience"`
	Visibility     RouteVisibility `json:"visibility,omitempty"`
	TransportMode  string          `json:"transportMode,omitempty"`
	GeomGeoJSON    string          `json:"geomGeojson,omitempty"`
	Points         []RoutePoint    `json:"points"`
}

type UserSavedRoute struct {
	ID          int     `json:"id"`
	UserID      int     `json:"userId"`
	RouteID     int     `json:"routeId"`
	Status      string  `json:"status"` // 'planned', 'completed'
	CompletedAt *string `json:"completedAt,omitempty"`
	CreatedAt   string  `json:"createdAt"`
	Route       *Route  `json:"route,omitempty"`
}

type BookmarkRouteRequest struct {
	Status string `json:"status,omitempty"` // 'planned', 'completed'
}

type ShareRouteRequest struct {
	SharedWithUserID int    `json:"sharedWithUserId,omitempty"`
	Permission       string `json:"permission,omitempty"` // 'view', 'edit'
}

type RateRouteRequest struct {
	Rating  int    `json:"rating"` // 1-5
	Comment string `json:"comment,omitempty"`
}

type ZoneCollection struct {
	Type     string `json:"type"`
	Features []Zone `json:"features"`
}

type Cycleway struct {
	ID          string          `json:"id"`
	Eje         string          `json:"eje"`
	Inicio      string          `json:"inicio"`
	Fin         string          `json:"fin"`
	KM          float64         `json:"km"`
	Coordinates json.RawMessage `json:"coordinates"` // Array of [lng, lat]
}

// ── Models para Perfil de Usuario y Seguimiento ──────────────────────────

type MyProfile struct {
	ID             int    `json:"id"`
	Name           string `json:"name"`
	Email          string `json:"email"`
	Picture        string `json:"picture"`
	Bio            string `json:"bio"`
	UserType       string `json:"userType"`
	FollowerCount  int    `json:"followerCount"`
	FollowingCount int    `json:"followingCount"`
}

type PublicUserProfile struct {
	ID             int    `json:"id"`
	Name           string `json:"name"`
	Picture        string `json:"picture"`
	Bio            string `json:"bio"`
	FollowerCount  int    `json:"followerCount"`
	FollowingCount int    `json:"followingCount"`
	IsFollowing    bool   `json:"isFollowing"`
}

type UpdateProfileRequest struct {
	Name string `json:"name"`
	Bio  string `json:"bio"`
}

type UserSearchResult struct {
	ID            int    `json:"id"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	FollowerCount int    `json:"followerCount"`
	IsFollowing   bool   `json:"isFollowing"`
}

// ── Models para Medios de Edificios (Building Media) ─────────────────────

type BuildingMedia struct {
	ID        int    `json:"id"`
	ZoneID    int    `json:"zone_id"`
	Floor     int    `json:"floor"`
	Type      string `json:"type"`      // "photo", "video", "video360", "floorplan", "audio"
	URL       string `json:"url"`
	Thumbnail string `json:"thumbnail,omitempty"`
	Title     string `json:"title"`
	Caption   string `json:"caption,omitempty"`
	SortOrder int    `json:"sort_order"`
	CreatedAt string `json:"created_at,omitempty"`
}

type CreateBuildingMediaRequest struct {
	ZoneID    int    `json:"zone_id"`
	Floor     int    `json:"floor"`
	Type      string `json:"type"`
	URL       string `json:"url"`
	Thumbnail string `json:"thumbnail,omitempty"`
	Title     string `json:"title"`
	Caption   string `json:"caption,omitempty"`
	SortOrder int    `json:"sort_order"`
}

// ── Models para Puntos de Interés Interiores (Indoor POIs) ───────────────

type IndoorPOI struct {
	ID          int     `json:"id"`
	ZoneID      int     `json:"zone_id"`
	Floor       int     `json:"floor"`
	Name        string  `json:"name"`
	Icon        string  `json:"icon"`        // "restaurant", "elevator", "wc", "parking", etc.
	Lat         float64 `json:"lat"`
	Lng         float64 `json:"lng"`
	Description string  `json:"description,omitempty"`
	Schedule    string  `json:"schedule,omitempty"`
}

type CreateIndoorPOIRequest struct {
	ZoneID      int     `json:"zone_id"`
	Floor       int     `json:"floor"`
	Name        string  `json:"name"`
	Icon        string  `json:"icon"`
	Lat         float64 `json:"lat"`
	Lng         float64 `json:"lng"`
	Description string  `json:"description,omitempty"`
	Schedule    string  `json:"schedule,omitempty"`
}

// ── Models para Novedades de Negocios y Notificaciones ─────────────────────

type BranchUpdate struct {
	ID          int    `json:"id"`
	BranchID    int    `json:"branchId"`
	Title       string `json:"title"`
	Description string `json:"description"`
	IsActive    bool   `json:"isActive"`
	ExpiresAt   string `json:"expiresAt,omitempty"`
	CreatedAt   string `json:"createdAt"`
}

type CreateBranchUpdateRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	ExpiresIn   int    `json:"expiresIn"` // Horas de vigencia
}

type UserNotification struct {
	ID          int    `json:"id"`
	UserID      int    `json:"userId"`
	Type        string `json:"type"`
	ReferenceID *int   `json:"referenceId,omitempty"`
	Title       string `json:"title"`
	Message     string `json:"message"`
	IsRead      bool   `json:"isRead"`
	CreatedAt   string `json:"createdAt"`
}
